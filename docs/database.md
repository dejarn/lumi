# Database

_Last updated: 2026-06-05_

## Engine & access

- **Database**: PostgreSQL 18
- **ORM**: Prisma 7 (migrations, type-safe queries, Prisma Studio for inspection)
- **ID strategy**: UUID v4 on all primary keys (`@default(uuid())`)

## Multi-user & ownership

Single-apartment instance. No row-level tenant isolation. All admins share full access to all data. Two roles — `ADMIN` and `USER` (see vision). The `active` flag on `User` enables instant access revocation when a flatmate leaves (see [Authentication](#authentication)).

## Source of truth

PostgreSQL is the single source of truth for device state. The `mqtt-bridge` service writes device state on every incoming MQTT message or Hue event; Next.js reads from the DB and never queries devices directly. Live state is therefore stored **on the `Device` row itself** (no separate state table) so the SSE hot path needs no join.

---

## Enums

| Enum | Values | Notes |
|---|---|---|
| `Role` | `ADMIN` \| `USER` | App role. |
| `Protocol` | `HUE` \| `LUMI` \| `ZIGBEE` | Integration protocol of a device. |
| `DeviceKind` | `LIGHT` \| `SENSOR` | What the device does. Lights are controllable; sensors emit events. |
| `TriggerType` | `CRON` \| `SENSOR` | How a trigger fires. |

---

## Entities

### `User`

| Column | Type | Notes |
|---|---|---|
| `id` | `String` (UUID) | PK |
| `username` | `String` | Unique |
| `hashedPassword` | `String` | bcrypt |
| `role` | `Role` | `ADMIN` \| `USER` |
| `active` | `Boolean` | `@default(true)`. Set `false` to revoke access. Checked on every request — see below. |
| `createdAt` | `DateTime` | Auto |

- No email field. Authentication via username + password (NextAuth credentials provider).
- The first admin is bootstrapped from environment variables on startup (no open registration). Additional accounts are created by an admin.
- **Revocation model**: sessions are JWT (no `Session` table). To cut off a flatmate, set `active = false` (or delete the row). Every authenticated request re-validates the JWT's `userId` against the DB and rejects if the user is missing or `active = false`. Token expiry can therefore be long without weakening revocation.

---

### `Invite`

Flatmate onboarding tokens (see `docs/api.md` invites flow).

| Column | Type | Notes |
|---|---|---|
| `id` | `String` (UUID) | PK — used by `DELETE /api/invites/[id]` |
| `tokenHash` | `String` | Unique SHA-256 of the raw invite token |
| `role` | `Role` | Role granted on accept |
| `createdById` | `String?` | FK → `User`, `onDelete: SetNull` |
| `expiresAt` | `DateTime` | Expiry |
| `usedAt` | `DateTime?` | Set on successful accept |
| `createdAt` | `DateTime` | Auto |

---

### `Device`

A single table covers all three protocols. The internal `id` is a UUID; `externalId` holds the protocol-native identifier.

| Column | Type | Notes |
|---|---|---|
| `id` | `String` (UUID) | PK — internal, stable. |
| `name` | `String` | Display name (e.g. `"Salon strip"`). |
| `protocol` | `Protocol` | `HUE` \| `LUMI` \| `ZIGBEE`. |
| `externalId` | `String` | Protocol-native identity. Hue resource ID / ESP32 `DEVICE_ID` hex (`a3f1`) / Zigbee2MQTT friendly name. |
| `kind` | `DeviceKind` | `LIGHT` \| `SENSOR`. |
| `zone` | `Int` | `@default(0)`. Mirror of the device-side zone (LUMI/ESP32 only). Read-only in the app — see [Zone](#zone). |
| `reachable` | `Boolean` | `@default(true)`. Written by the bridge from `lumi/device/+/availability` (LWT) for LUMI, Zigbee2MQTT availability for ZIGBEE, and Hue REST polling for HUE. ACK timeouts do **not** affect it (busy ≠ offline). See [architecture.md](architecture.md#device-reachability). |
| `protoVersion` | `Int?` | lumi-protocol version announced at boot (LUMI only). |
| `lastSeen` | `DateTime?` | Last MQTT/Hue contact. |
| `createdAt` | `DateTime` | Auto. |

**Live light state** (populated when `kind = LIGHT`, else null):

| Column | Type | Notes |
|---|---|---|
| `power` | `Boolean?` | On / off. |
| `brightness` | `Int?` | Master dimmer 0–255 (lumi-protocol `BRIGHTNESS`). |
| `hue` | `Int?` | 0–65535 (lumi-protocol `H`). |
| `saturation` | `Int?` | 0–255 (`S`). |
| `colorBrightness` | `Int?` | 0–255 — brightness **component of the color** (`B`), orthogonal to `brightness`. See protocol [Brightness model](https://github.com/dejarn/lumi-protocol/blob/main/spec/v1/protocol.md). |
| `animId` | `Int?` | `@default(0)`. Running animation, 0 = none. |
| `animSpeed` | `Int?` | Animation speed (lumi-protocol); null when no animation. Live state only — not stored on `SceneDevice`. |
| `animIntensity` | `Int?` | Animation intensity (lumi-protocol); null when no animation. Live state only — not stored on `SceneDevice`. |

**Live sensor state** (populated when `kind = SENSOR`, else null):

| Column | Type | Notes |
|---|---|---|
| `sensorActive` | `Boolean?` | Current sensor reading (e.g. presence detected). |

- **Unique constraint**: `(protocol, externalId)` — one row per physical device.
- The two brightness fields (`brightness` and `colorBrightness`) are independent, mirroring the lumi-protocol Hue-style model: master dimmer × color. Both are stored so `STATE_REPORT` round-trips exactly.
- Relations: `sceneDevices SceneDevice[]`, `sensorTriggers Trigger[]` (as a trigger's sensor source).

---

### `Scene`

A named snapshot of light states, activatable in one action. Spans any combination of lights regardless of protocol.

| Column | Type | Notes |
|---|---|---|
| `id` | `String` (UUID) | PK |
| `name` | `String` | Unique |
| `createdAt` | `DateTime` | Auto |

- Relations: `sceneDevices SceneDevice[]`, `triggers Trigger[]`.
- Activating a scene sets every linked device to its saved `SceneDevice` state simultaneously.

---

### `SceneDevice`

The saved target state of one light within a scene.

| Column | Type | Notes |
|---|---|---|
| `sceneId` | `String` (UUID) | FK → `Scene` |
| `deviceId` | `String` (UUID) | FK → `Device` |
| `power` | `Boolean` | Target on/off |
| `brightness` | `Int` | Master dimmer 0–255 |
| `hue` | `Int` | 0–65535 |
| `saturation` | `Int` | 0–255 |
| `colorBrightness` | `Int` | 0–255 |
| `animId` | `Int` | `@default(0)` |

- **Composite PK**: `(sceneId, deviceId)`.
- **Lights only.** A `SENSOR` device has no settable state, so it is never added to a scene. Enforced at the API level.
- On scene activation, each `SceneDevice` row is translated by `mqtt-bridge` into the correct protocol command (`SET_POWER` / `SET_BRIGHTNESS` / `SET_COLOR` / `SET_ANIMATION` for LUMI, Hue REST for HUE).

---

### `Trigger`

A condition that activates a scene automatically — either a cron schedule or a sensor event. Polymorphic on `type`; the type-specific columns are nullable.

| Column | Type | Notes |
|---|---|---|
| `id` | `String` (UUID) | PK |
| `name` | `String` | Display name |
| `type` | `TriggerType` | `CRON` \| `SENSOR` |
| `sceneId` | `String` (UUID) | FK → `Scene` — the scene to activate when the trigger fires |
| `enabled` | `Boolean` | `@default(true)`. Disable without deleting. |
| `cronExpr` | `String?` | Cron expression. Required when `type = CRON`, else null. |
| `sensorDeviceId` | `String?` (UUID) | FK → `Device` (a `SENSOR`), `onDelete: SetNull`. Required when `type = SENSOR`, else null. If the source sensor is deleted, this is nulled and the app sets `enabled = false` (see [automation.md](automation.md#dependency-rules)). |
| `sensorState` | `Boolean?` | The `sensorActive` value that fires the trigger (e.g. `true` = presence detected). `type = SENSOR` only. |
| `lastFiredAt` | `DateTime?` | Last time the trigger activated its scene. |
| `createdAt` | `DateTime` | Auto |

- **Type invariants** (enforced at the API level, not by the DB):
  - `CRON` → `cronExpr` set, `sensorDeviceId` / `sensorState` null.
  - `SENSOR` → `sensorDeviceId` + `sensorState` set, `cronExpr` null.
- `sensorDeviceId` must reference a `Device` with `kind = SENSOR`.
- **Best-effort reliability**: if the Pi is unreachable at a CRON fire time, the trigger is skipped silently — no retry queue (see vision trade-offs). Trigger evaluation runs in the Next.js server; full firing lifecycle (cron scheduling, sensor evaluation, no v1 debounce) lives in [automation.md](automation.md).

---

## Zone

Zones are a **hardware grouping for ESP32 (LUMI) devices, owned by the device** and persisted in its NVS — used for MQTT topic routing (`lumi/zone/{id}/cmd`). The `Device.zone` column is a **read-only mirror**: the device announces its zone in `DISCOVERY_ANNOUNCE`, and `mqtt-bridge` writes it to the row. Changing a device's zone is done by sending the protocol `SET_ZONE` command (which the device persists), not by editing the DB directly. HUE and ZIGBEE devices ignore `zone` (it stays `0`).

Zones are physical and distinct from scenes, which are logical (see vision core concepts).

---

## Relationships (summary)

```
User            (standalone — auth only)

Device 1───* SceneDevice *───1 Scene
Device 1───* Trigger (as sensor source, optional)
Scene  1───* Trigger
```

- Deleting a `Scene` cascades to its `SceneDevice` rows and its `Trigger` rows.
- Deleting a `Device` cascades to its `SceneDevice` rows. Deleting a `SENSOR` device referenced by a `Trigger` is **allowed** and **disables** the dependent trigger (`enabled = false`) rather than blocking the deletion — see [automation.md](automation.md#dependency-rules).
</content>
</invoke>

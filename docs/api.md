# API

_Last updated: 2026-06-09_

This document covers the **Next.js Route Handlers** — the surface the browser talks to. The internal API between Next.js and `mqtt-bridge` (and the MQTT/protocol behaviour behind it) lives in [bridge.md](bridge.md).

## Style & format

- **Style**: REST
- **Format**: JSON (`Content-Type: application/json`)
- **Base path**: `/api`
- **Auth**: NextAuth JWT session cookie. All endpoints require a valid session unless marked **public**.
- **Roles**: `ADMIN` > `USER`. Checked per endpoint where noted.

### Authentication & revocation

- `/api/auth/*` is handled by NextAuth (credentials provider). Login returns a JWT session cookie with a long `maxAge`.
- Every request re-validates the JWT's `userId` against the DB: if the user is missing or `active = false`, the request is rejected `401`. This is how a departed flatmate is cut off without a server-side session store (see [architecture.md](architecture.md#authentication--authorization)).

### Roles

| Role | Can |
|---|---|
| `USER` | List/read devices, scenes, triggers. Control devices. Activate scenes. Subscribe to the SSE stream. |
| `ADMIN` | Everything `USER` can, plus: rename/remove devices, set zones, trigger discovery, create/edit/delete scenes and triggers, manage users. |

## Error codes

| Code | Meaning |
|---|---|
| `400` | Invalid request body or params |
| `401` | Not authenticated, or user no longer active |
| `403` | Authenticated but insufficient role |
| `404` | Resource not found |
| `409` | Conflict (e.g. duplicate scene name) |
| `410` | Resource permanently gone (e.g. deleted device still referenced) |
| `422` | Valid JSON but semantically rejected (e.g. adding a SENSOR to a scene) |
| `502` | `mqtt-bridge` unreachable or returned an error |
| `500` | Server error |

## Command delivery & best-effort

Endpoints that control hardware (`/devices/[id]/command`, `/scenes/[id]/activate`, `/devices/[id]/zone`, `/devices/discover`) do **not** talk to devices directly. They forward to `mqtt-bridge` over the internal API ([bridge.md](bridge.md)), which routes to the correct protocol. Delivery is **best-effort**: the handler returns once the bridge has accepted the request, not once every device has physically acknowledged. The *real* resulting state arrives asynchronously over the SSE stream.

## Pagination

None. Single-apartment data volume is small.

---

## Devices

Devices are **auto-discovered** — `mqtt-bridge` upserts them into the DB from discovery announcements (LUMI), Zigbee2MQTT, and the Hue Bridge. There is therefore **no create endpoint**. Admins rename, remove, and configure what discovery found.

| Method | Path | Description | Role |
|---|---|---|---|
| `GET` | `/api/devices` | List all devices with current state | USER |
| `GET` | `/api/devices/[id]` | Get one device | USER |
| `PATCH` | `/api/devices/[id]` | Rename a device | ADMIN |
| `DELETE` | `/api/devices/[id]` | Remove a stale device | ADMIN |
| `POST` | `/api/devices/[id]/command` | Control a device (power/brightness/color/animation) | USER |
| `POST` | `/api/devices/[id]/zone` | Set the device zone (LUMI only) — sends `SET_ZONE` | ADMIN |
| `POST` | `/api/devices/discover` | Trigger a discovery sweep — broadcasts `DISCOVERY_REQUEST` | ADMIN |

**GET /api/devices** response:
```json
[{
  "id": "...",
  "name": "Salon strip",
  "protocol": "LUMI",
  "kind": "LIGHT",
  "zone": 1,
  "reachable": true,
  "power": true,
  "brightness": 200,
  "hue": 32768,
  "saturation": 255,
  "colorBrightness": 200,
  "animId": 0
}]
```
- `SENSOR` devices return `sensorActive` instead of the light fields.

**PATCH /api/devices/[id]** body:
```json
{ "name": "Salon strip" }
```

**POST /api/devices/[id]/command** body — discriminated by `type`:
```json
{ "type": "power",      "on": true }
{ "type": "brightness", "brightness": 200 }
{ "type": "color",      "hue": 32768, "saturation": 255, "brightness": 200 }
{ "type": "animation",  "animId": 2, "speed": 128, "intensity": 200 }
{ "type": "stopAnimation" }
```
- Field ranges match the protocol (`hue` 0–65535, the rest 0–255). See [lumi-protocol spec](https://github.com/dejarn/lumi-protocol/blob/main/spec/v1/protocol.md).
- Only valid on `kind = LIGHT`. `422` on a `SENSOR`.
- Returns `202 Accepted` — the confirmed state arrives via SSE.

**POST /api/devices/[id]/zone** body:
```json
{ "zone": 2 }
```
- LUMI only. Forwards `SET_ZONE` through the bridge; the device persists the zone in NVS and the mirror `Device.zone` is updated on the next announce. `422` for HUE/ZIGBEE.

**POST /api/devices/discover** — no body. Broadcasts a discovery request; newly found devices appear in `GET /api/devices` (and via SSE) as the bridge upserts them.

---

## Scenes

| Method | Path | Description | Role |
|---|---|---|---|
| `GET` | `/api/scenes` | List scenes | USER |
| `GET` | `/api/scenes/[id]` | Get a scene with its saved device states | USER |
| `POST` | `/api/scenes` | Create an (empty) scene | ADMIN |
| `PATCH` | `/api/scenes/[id]` | Rename a scene | ADMIN |
| `DELETE` | `/api/scenes/[id]` | Delete a scene | ADMIN |
| `POST` | `/api/scenes/[id]/capture` | Save the **current** state of the given lights into the scene | ADMIN |
| `POST` | `/api/scenes/[id]/activate` | Apply the scene — fan out all device states at once | USER |

**POST /api/scenes** body:
```json
{ "name": "Soirée" }
```
- `name` unique → `409` on conflict.

**GET /api/scenes/[id]** response:
```json
{
  "id": "...",
  "name": "Soirée",
  "devices": [
    {
      "deviceId": "...",
      "power": true,
      "brightness": 120,
      "hue": 5000,
      "saturation": 255,
      "colorBrightness": 180,
      "animId": 0,
      "name": "Salon strip",
      "reachable": true,
      "kind": "LIGHT",
      "current": {
        "power": true,
        "brightness": 200,
        "hue": 32768,
        "saturation": 255,
        "colorBrightness": 200,
        "animId": 0,
        "animSpeed": 128,
        "animIntensity": 200
      }
    }
  ]
}
```
- Target fields (`power`, `brightness`, `hue`, …) are the scene's saved `SceneDevice` state. `name`, `reachable`, `kind`, and `current` reflect the device's live DB state (for the `SceneSheet` diff view).

**POST /api/scenes/[id]/capture** body — the lights to snapshot:
```json
{ "deviceIds": ["...", "..."] }
```
- **Replaces the scene's full membership** with exactly the given `deviceIds` (devices not listed are removed). Reads each selected device's **current** state from the DB and writes it as `SceneDevice` rows. `deviceIds: []` clears the scene. Only `LIGHT` devices accepted; a `SENSOR` id → `422`.

**POST /api/scenes/[id]/activate** — no body. Sends every `SceneDevice` row to the bridge in one fan-out. Best-effort: returns `202` once accepted; resulting device states stream back over SSE. Partial failures (one unreachable device) do not roll back the others.

---

## Triggers

| Method | Path | Description | Role |
|---|---|---|---|
| `GET` | `/api/triggers` | List triggers | USER |
| `POST` | `/api/triggers` | Create a trigger | ADMIN |
| `PATCH` | `/api/triggers/[id]` | Update a trigger (e.g. enable/disable) | ADMIN |
| `DELETE` | `/api/triggers/[id]` | Delete a trigger | ADMIN |

**POST /api/triggers** body — discriminated by `type`:
```json
{ "type": "CRON",   "name": "Réveil",      "sceneId": "...", "cronExpr": "0 7 * * 1-5" }
{ "type": "SENSOR", "name": "Couloir nuit", "sceneId": "...", "sensorDeviceId": "...", "sensorState": true }
```
- `CRON` requires `cronExpr`; `SENSOR` requires `sensorDeviceId` (a `SENSOR` device) + `sensorState`. Mismatched fields → `422`.
- `enabled` defaults to `true`.

**PATCH /api/triggers/[id]** body (partial) — **ADMIN** for all fields; **exception: a body strictly equal to `{"enabled": boolean}` is allowed for USER** (on/off toggle from the dashboard):
```json
{ "enabled": false }
```

Firing semantics (cron scheduling, sensor debounce, best-effort on Pi downtime) are documented in [automation.md](automation.md).

---

## Users

| Method | Path | Description | Role |
|---|---|---|---|
| `GET` | `/api/users` | List users | ADMIN |
| `PATCH` | `/api/users/[id]` | Update role or `active` | ADMIN |
| `DELETE` | `/api/users/[id]` | Delete a user | ADMIN |

**GET /api/users** response:
```json
[{ "id": "...", "username": "arnaud", "role": "ADMIN", "active": true, "createdAt": "..." }]
```
`hashedPassword` never returned.

There is **no direct create endpoint**. New accounts are onboarded through the invite flow below — an admin issues an invite, the new flatmate sets their own username and password via the invite link. This keeps passwords out of admin hands.

**PATCH /api/users/[id]** body (partial):
```json
{ "active": false }
```
- Setting `active: false` revokes access at the next request (see [Authentication](#authentication--revocation)). Use this when a flatmate moves out rather than relying on token expiry.

---

## Invites

Account onboarding is invite-based. An admin creates an invite (choosing the role the new user will get); the invitee opens `/invite/[token]` ([frontend.md](frontend.md#route-map)) and registers with their own credentials. Consuming an invite creates the `User` and marks the invite used.

| Method | Path | Description | Role |
|---|---|---|---|
| `GET` | `/api/invites` | List invites (pending + used) | ADMIN |
| `POST` | `/api/invites` | Create an invite — returns the token/link | ADMIN |
| `DELETE` | `/api/invites/[id]` | Revoke a pending invite | ADMIN |
| `GET` | `/api/invites/[token]` | **Public** — validate a token before showing the form | Public |
| `POST` | `/api/invites/[token]/accept` | **Public** — consume the invite, create the account | Public |

**POST /api/invites** body:
```json
{ "role": "USER" }
```
- `role` defaults to `USER`. Response returns the one-time token:
```json
{ "id": "...", "token": "...", "role": "USER", "expiresAt": "...", "usedAt": null }
```
- Token is single-use and time-limited (`expiresAt`). The raw token is returned **once** at creation; only a hash is stored.

**GET /api/invites/[token]** — no body. Validates the token without consuming it (so the form can render or show an error). `404` if unknown, `410` if expired or already used.

**POST /api/invites/[token]/accept** body:
```json
{ "username": "coloc", "password": "..." }
```
- Creates a `User` with the invite's `role`, marks the invite `usedAt`, and (optionally) logs the user in.
- `username` unique → `409` on conflict.
- `410` if the token is expired or already used. `400` on weak/missing password.

---

## Stream (SSE)

| Method | Path | Description | Role |
|---|---|---|---|
| `GET` | `/api/stream` | Server-Sent Events — live device state | USER |

A single global stream. The dashboard subscribes once; every device tile listens to it. Its only job is to keep the browser's view of **device state** in sync with reality — state changes driven by other users, automation triggers, physical/Hue control, and reachability (see [architecture.md](architecture.md#real-time)).

When `mqtt-bridge` writes a new device state to PostgreSQL, the handler pushes a patch:

```
event: device-state
data: {
  "deviceId": "...",
  "power": true,
  "brightness": 200,
  "hue": 32768,
  "saturation": 255,
  "colorBrightness": 200,
  "animId": 0,
  "reachable": true
}
```

- One event per changed device. The client applies the patch to that tile's local state — no full reload.
- `SENSOR` devices push `sensorActive` instead of the light fields.
- The stream carries **only** device state. It never pushes "a trigger fired" or "a scene was activated" — only the resulting device-state changes. The dashboard does not care *why* state changed, only *what* it is now.

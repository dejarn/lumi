# Automation

_Last updated: 2026-06-09_

Automation is the heart of Lumi: **scenes** (named snapshots of light states) activated either by hand or automatically by **triggers** (a cron schedule or a sensor event). This document covers the full lifecycle — who evaluates triggers, when scenes fire, and the reliability guarantees. Data shapes live in [database.md](database.md); HTTP surfaces in [api.md](api.md); device delivery in [bridge.md](bridge.md).

## Where it runs

All trigger evaluation lives in the **Next.js server** — the long-running Node process, not request-scoped handlers. A scheduler is started once at server boot via Next's `instrumentation.ts` hook. The `mqtt-bridge` never reads scene or trigger tables; it only routes per-device commands. This keeps one owner for automation logic (Next, which owns the DB) and one owner for protocol delivery (bridge).

```
Next.js server process
  ├── instrumentation.ts → start scheduler once
  │     ├── node-cron timers   ← CRON triggers
  │     └── PG LISTEN device_state ← SENSOR triggers
  │
  └── on fire → read Scene + SceneDevice rows
                → POST /command/:deviceId to bridge (one per light)
```

---

## Scene activation

Whether fired by a user (`POST /api/scenes/[id]/activate`) or by a trigger, activation is identical:

1. Read the scene's `SceneDevice` rows.
2. For each row, `POST /command/:deviceId` to the bridge with the saved light state.
3. The bridge routes each command to the right protocol and confirms delivery.

**Fan-out, all at once. Best-effort.** Commands are sent together; the call returns without waiting for every device. A partial failure (one unreachable light) does **not** roll back the others. The resulting device states stream back to the dashboard over SSE as each `STATE_REPORT` / Hue event lands.

**Shared devices across scenes.** Two scenes may include the same `LIGHT`. Activating them in succession applies **last activation wins** — each fan-out overwrites that device's state with the latest scene's saved values. There is no merge, no warning, and no rollback if the user expected both scenes to "stack". This is consistent with the best-effort model above.

Scenes contain `LIGHT` devices only — sensors have no settable state and are rejected at the API.

---

## CRON triggers

A `CRON` trigger holds a `cronExpr` (e.g. `0 7 * * 1-5`). The UI never exposes raw cron syntax: admins pick hour, minute, and day presets in `TriggerSheet`, which generates `cronExpr` via `buildCron` (`src/lib/automation/cron-human.ts`). List cards show the same schedule in French via `cronToHuman`. The scheduler registers one `node-cron` job per enabled `CRON` trigger at boot.

- **Fire**: at the scheduled time → activate the linked scene (fan-out above) → set `Trigger.lastFiredAt`.
- **Reload**: creating, editing, enabling/disabling, or deleting a `CRON` trigger re-registers the scheduler's jobs so changes take effect without a restart.
- **Best-effort, no catch-up**: if the Pi is offline at fire time, the trigger is simply missed — there is no retry queue and no catch-up on the next boot (accepted trade-off, see [vision](vision.md)). A fire is also skipped silently if the bridge is unreachable.

---

## SENSOR triggers

A `SENSOR` trigger links a `sensorDeviceId` (a `SENSOR` device) and a `sensorState` (the `sensorActive` value that fires it, e.g. `true` = presence detected).

Evaluation rides on the **same PG `LISTEN/NOTIFY` channel** the SSE handler uses ([bridge.md](bridge.md#real-time-state-back-to-the-browser)): when the bridge writes a new `sensorActive` and issues `NOTIFY device_state`, the scheduler:

1. Receives the notification for that `deviceId`.
2. Finds enabled `SENSOR` triggers whose `sensorDeviceId` matches.
3. For each whose `sensorState` equals the new `sensorActive` value → activate the linked scene → set `lastFiredAt`.

No separate sensor subscription is needed — the device-state notification already carries the change.

### No debounce in v1

A presence sensor can emit many `true`/`false` flips for a single passage. **v1 fires on every matching event** — no debounce, no cooldown. This can cause repeated activations (visible flicker) on a noisy sensor.

This is a known, accepted v1 limitation. The planned remedy is a **fixed global cooldown** (ignore re-fires of the same trigger within N seconds), cheaply implementable later using the existing `Trigger.lastFiredAt` column — no schema change required. Per-trigger cooldown is out of scope.

---

## Enable / disable

Every trigger has `enabled` (default `true`). Disabling (`PATCH /api/triggers/[id]` → `{ "enabled": false }`) stops it firing without deleting it. **USER role may send a body of exactly `{"enabled": boolean}` to toggle on/off** (useful from the dashboard); any other field requires ADMIN:
- `CRON` → its `node-cron` job is removed on reload.
- `SENSOR` → it is skipped during evaluation.

Re-enabling re-registers it.

---

## Dependency rules

| Action | Effect |
|---|---|
| Delete a `Scene` | Cascades to its `SceneDevice` rows **and** its `Trigger` rows (a trigger with no scene has nothing to do). |
| Delete a `LIGHT` device | Cascades to its `SceneDevice` rows. Scenes keep working with their remaining lights. |
| Delete a `SENSOR` device referenced by a trigger | The dependent `SENSOR` trigger is **disabled** (`enabled = false`), not deleted — the deletion is allowed and the trigger is preserved (minus its source) for the admin to repoint or remove. |

---

## Reliability summary

- **Delivery**: best-effort fan-out, no rollback on partial failure.
- **CRON**: no catch-up after downtime, no retry queue.
- **SENSOR**: fires on every matching event in v1 (no debounce).
- **Recovery**: retained MQTT `state` / `availability` topics mean the dashboard re-syncs to real device state after any reconnect, regardless of missed automations.

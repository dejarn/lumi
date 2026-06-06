import { prisma } from "@/lib/prisma"
import { sendCommand } from "@/lib/bridge-client"

// Trigger evaluation runs in the Next.js server process, NOT the bridge
// (CLAUDE.md rule 6, docs/automation.md). Started once from instrumentation.ts.
//
//   ├── node-cron timers          ← CRON triggers
//   └── PG LISTEN device_state    ← SENSOR triggers
//
// v1 has no debounce: a noisy presence sensor fires on every flip.

let started = false

/** Boot the scheduler once. Idempotent. */
export async function startScheduler(): Promise<void> {
  if (started) return
  started = true

  // TODO: register node-cron jobs for enabled CRON triggers.
  await reloadCronJobs()

  // TODO: open a dedicated PG client doing `LISTEN device_state`; on each
  // notification call onSensorEvent(deviceId).
}

/**
 * Re-register every CRON job from the DB. Called on boot and after any
 * create/edit/enable/disable/delete of a CRON trigger so changes take effect
 * without a restart (docs/automation.md#cron-triggers).
 */
export async function reloadCronJobs(): Promise<void> {
  // TODO: read enabled CRON triggers, (re)schedule one node-cron job each.
  void prisma
}

/**
 * Handle a `device_state` notification for a SENSOR. Finds enabled SENSOR
 * triggers whose sensorDeviceId matches and whose sensorState equals the new
 * sensorActive value, then activates the linked scene (best-effort fan-out).
 */
export async function onSensorEvent(deviceId: string): Promise<void> {
  // TODO: query matching triggers, activate scenes via activateScene().
  void deviceId
}

/**
 * Best-effort scene fan-out: read SceneDevice rows, POST one command per light
 * to the bridge. No rollback on partial failure (docs/automation.md).
 */
export async function activateScene(sceneId: string): Promise<void> {
  const rows = await prisma.sceneDevice.findMany({ where: { sceneId } })
  await Promise.all(
    rows.map((row) =>
      sendCommand(row.deviceId, {
        type: "color",
        hue: row.hue,
        saturation: row.saturation,
        brightness: row.brightness,
      }).catch(() => {
        // best-effort: swallow per-device failures
      }),
    ),
  )
  await prisma.scene.findUnique({ where: { id: sceneId } })
  // TODO: also fan out power/animation state, set Trigger.lastFiredAt when fired by a trigger.
}

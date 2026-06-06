import cron from "node-cron"
import { Client } from "pg"
import { prisma } from "@/lib/prisma"
import { sendCommand } from "@/lib/bridge-client"
import type { DeviceCommand } from "@/lib/types"

// Trigger evaluation runs in the Next.js server process, NOT the bridge
// (CLAUDE.md rule 6, docs/automation.md). Started once from instrumentation.ts.
//
//   ├── node-cron timers          ← CRON triggers
//   └── PG LISTEN device_state    ← SENSOR triggers
//
// v1 has no debounce: a noisy presence sensor fires on every flip.

let started = false
const cronJobs = new Map<string, cron.ScheduledTask>()

/** Boot the scheduler once. Idempotent. */
export async function startScheduler(): Promise<void> {
  if (started) return
  started = true

  await reloadCronJobs()

  const pgClient = new Client({ connectionString: process.env.DATABASE_URL })
  await pgClient.connect()
  await pgClient.query("LISTEN device_state")
  pgClient.on("notification", (msg) => {
    if (msg.channel === "device_state" && msg.payload) {
      onSensorEvent(msg.payload).catch(() => {})
    }
  })
  pgClient.on("error", (err) => {
    console.error("[scheduler] PG client error", err)
  })
}

/**
 * Re-register every CRON job from the DB. Called on boot and after any
 * create/edit/enable/disable/delete of a CRON trigger so changes take effect
 * without a restart (docs/automation.md#cron-triggers).
 */
export async function reloadCronJobs(): Promise<void> {
  for (const job of cronJobs.values()) job.stop()
  cronJobs.clear()

  const triggers = await prisma.trigger.findMany({
    where: { type: "CRON", enabled: true, cronExpr: { not: null } },
    select: { id: true, cronExpr: true, sceneId: true },
  })

  for (const trigger of triggers) {
    if (!trigger.cronExpr || !cron.validate(trigger.cronExpr)) continue
    const job = cron.schedule(trigger.cronExpr, async () => {
      await activateScene(trigger.sceneId)
      await prisma.trigger
        .update({ where: { id: trigger.id }, data: { lastFiredAt: new Date() } })
        .catch(() => {})
    })
    cronJobs.set(trigger.id, job)
  }
}

/**
 * Handle a `device_state` notification for a SENSOR. Finds enabled SENSOR
 * triggers whose sensorDeviceId matches and whose sensorState equals the new
 * sensorActive value, then activates the linked scene (best-effort fan-out).
 */
export async function onSensorEvent(deviceId: string): Promise<void> {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { kind: true, sensorActive: true },
  })
  if (!device || device.kind !== "SENSOR" || device.sensorActive === null) return

  const triggers = await prisma.trigger.findMany({
    where: {
      type: "SENSOR",
      enabled: true,
      sensorDeviceId: deviceId,
      sensorState: device.sensorActive,
    },
    select: { id: true, sceneId: true },
  })

  await Promise.all(
    triggers.map(async (trigger) => {
      await activateScene(trigger.sceneId)
      await prisma.trigger
        .update({ where: { id: trigger.id }, data: { lastFiredAt: new Date() } })
        .catch(() => {})
    }),
  )
}

/**
 * Best-effort scene fan-out: read SceneDevice rows, POST one command per light
 * to the bridge. No rollback on partial failure (docs/automation.md).
 */
export async function activateScene(sceneId: string): Promise<void> {
  const rows = await prisma.sceneDevice.findMany({ where: { sceneId } })
  await Promise.all(
    rows.map(async (row) => {
      const commands: DeviceCommand[] = [{ type: "power", on: row.power }]

      if (row.animId !== 0) {
        // speed/intensity not stored in v1 STATE_REPORT — use defaults
        commands.push({ type: "stopAnimation" })
        commands.push({ type: "animation", animId: row.animId, speed: 128, intensity: 200 })
      } else {
        commands.push({ type: "color", hue: row.hue, saturation: row.saturation, brightness: row.brightness })
      }

      for (const cmd of commands) {
        await sendCommand(row.deviceId, cmd).catch(() => {})
      }
    }),
  )
}

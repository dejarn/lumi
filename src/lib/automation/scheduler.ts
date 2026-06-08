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
// globalThis guard: HMR re-imports this module in dev — close the old PG client first.

const schedulerGlobal = globalThis as typeof globalThis & { __lumiSchedulerStarted?: boolean }

const cronJobs = new Map<string, cron.ScheduledTask>()

let pgClient: Client | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectDelayMs = 1000
const MAX_RECONNECT_DELAY_MS = 30_000

async function attachPgListener(client: Client): Promise<void> {
  await client.query("LISTEN device_state")
  client.on("notification", (msg) => {
    if (msg.channel === "device_state" && msg.payload) {
      onSensorEvent(msg.payload).catch(() => {})
    }
  })
  client.on("error", (err) => {
    console.warn("[scheduler] PG client error", err)
    schedulePgReconnect()
  })
  client.on("end", () => {
    console.warn("[scheduler] PG client ended")
    schedulePgReconnect()
  })
}

async function connectPgListener(): Promise<void> {
  if (pgClient) {
    await pgClient.end().catch(() => {})
    pgClient = null
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  await attachPgListener(client)
  pgClient = client
  reconnectDelayMs = 1000
  console.info("[scheduler] PG listener connected")
}

function schedulePgReconnect(): void {
  if (reconnectTimer) return
  const delay = reconnectDelayMs
  reconnectDelayMs = Math.min(reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    void connectPgListener().catch((err) => {
      console.error("[scheduler] PG reconnect failed", err)
      schedulePgReconnect()
    })
  }, delay)
}

/** Boot the scheduler once. Idempotent (survives dev HMR via globalThis). */
export async function startScheduler(): Promise<void> {
  if (schedulerGlobal.__lumiSchedulerStarted) {
    if (pgClient) {
      await pgClient.end().catch(() => {})
      pgClient = null
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }
  schedulerGlobal.__lumiSchedulerStarted = true

  await reloadCronJobs()
  await connectPgListener()
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
    if (!trigger.cronExpr || !cron.validate(trigger.cronExpr)) {
      console.warn(`[scheduler] skipping invalid cronExpr for trigger ${trigger.id}`)
      continue
    }
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
      commands.push({ type: "brightness", brightness: row.brightness })

      if (row.animId !== 0) {
        // speed/intensity not stored in v1 STATE_REPORT — use defaults
        commands.push({ type: "stopAnimation" })
        commands.push({ type: "animation", animId: row.animId, speed: 128, intensity: 200 })
      } else {
        commands.push({
          type: "color",
          hue: row.hue,
          saturation: row.saturation,
          brightness: row.colorBrightness,
        })
      }

      for (const cmd of commands) {
        await sendCommand(row.deviceId, cmd).catch(() => {})
      }
    }),
  )
}

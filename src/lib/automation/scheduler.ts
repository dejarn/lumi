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
// All mutable state lives on globalThis so that route-handler bundles and the
// instrumentation bundle share one instance (H1) and HMR tear-down reaches the
// real PG client and cron jobs (H3).

type SchedulerState = {
  cronJobs: Map<string, cron.ScheduledTask>
  pgClient: Client | null
  reconnectTimer: ReturnType<typeof setTimeout> | null
  reconnectDelayMs: number
  started: boolean
  _id: string
}

const g = globalThis as typeof globalThis & { __lumiScheduler?: SchedulerState }

function getState(): SchedulerState {
  if (!g.__lumiScheduler) {
    g.__lumiScheduler = {
      cronJobs: new Map(),
      pgClient: null,
      reconnectTimer: null,
      reconnectDelayMs: 1000,
      started: false,
      _id: crypto.randomUUID(),
    }
  }
  return g.__lumiScheduler
}

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
  const s = getState()
  if (s.pgClient) {
    await s.pgClient.end().catch(() => {})
    s.pgClient = null
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  await attachPgListener(client)
  s.pgClient = client
  s.reconnectDelayMs = 1000
  console.info("[scheduler] PG listener connected")
}

function schedulePgReconnect(): void {
  const s = getState()
  if (s.reconnectTimer) return
  const delay = s.reconnectDelayMs
  s.reconnectDelayMs = Math.min(s.reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS)
  s.reconnectTimer = setTimeout(() => {
    s.reconnectTimer = null
    void connectPgListener().catch((err) => {
      console.error("[scheduler] PG reconnect failed", err)
      schedulePgReconnect()
    })
  }, delay)
}

/** Boot the scheduler once. Idempotent (survives dev HMR via globalThis). */
export async function startScheduler(): Promise<void> {
  const s = getState()
  if (s.started) {
    // HMR / re-import: tear down the OLD instance — reachable because state lives on globalThis
    if (s.pgClient) {
      await s.pgClient.end().catch(() => {})
      s.pgClient = null
    }
    if (s.reconnectTimer) {
      clearTimeout(s.reconnectTimer)
      s.reconnectTimer = null
    }
    // Note: do NOT clear cron jobs here — reloadCronJobs() below stops and recreates them.
  }
  s.started = true
  console.info(`[scheduler] startScheduler (state id=${s._id})`)

  await reloadCronJobs()
  await connectPgListener()
}

/**
 * Re-register every CRON job from the DB. Called on boot and after any
 * create/edit/enable/disable/delete of a CRON trigger so changes take effect
 * without a restart (docs/automation.md#cron-triggers).
 */
export async function reloadCronJobs(): Promise<void> {
  const s = getState()
  console.info(`[scheduler] reloadCronJobs (state id=${s._id}, jobs=${s.cronJobs.size})`)

  for (const job of s.cronJobs.values()) job.stop()
  s.cronJobs.clear()

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
    s.cronJobs.set(trigger.id, job)
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
        commands.push({ type: "stopAnimation" })
        commands.push({ type: "animation", animId: row.animId, speed: row.animSpeed, intensity: row.animIntensity })
      } else {
        commands.push({
          type: "color",
          hue: row.hue,
          saturation: row.saturation,
          brightness: row.colorBrightness,
        })
      }

      for (const cmd of commands) {
        const res = await sendCommand(row.deviceId, cmd).catch(() => null)
        if (!res || res.status === 502) break // bridge unreachable: abandon this device (best-effort, CLAUDE.md rule 2)
      }
    }),
  )
}

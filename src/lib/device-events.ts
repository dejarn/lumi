import { EventEmitter } from "node:events"
import { Client } from "pg"

// Single shared PG LISTEN client fanning out to all SSE streams (M4).
// One connection regardless of how many browser tabs are open — avoids
// exhausting max_connections on the Pi.

type DeviceEventsState = {
  emitter: EventEmitter
  client: Client | null
  reconnectTimer: ReturnType<typeof setTimeout> | null
  reconnectDelayMs: number
  _id: string
}

const MAX_RECONNECT_DELAY_MS = 30_000

const g = globalThis as typeof globalThis & { __lumiDeviceEvents?: DeviceEventsState }

function getState(): DeviceEventsState {
  if (!g.__lumiDeviceEvents) {
    const emitter = new EventEmitter()
    emitter.setMaxListeners(0) // unbounded — one listener per SSE client
    g.__lumiDeviceEvents = {
      emitter,
      client: null,
      reconnectTimer: null,
      reconnectDelayMs: 1000,
      _id: crypto.randomUUID(),
    }
  }
  return g.__lumiDeviceEvents
}

function scheduleReconnect(s: DeviceEventsState): void {
  if (s.reconnectTimer) return
  const delay = s.reconnectDelayMs
  s.reconnectDelayMs = Math.min(s.reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS)
  s.reconnectTimer = setTimeout(() => {
    s.reconnectTimer = null
    void connect(s).catch((err) => {
      console.error("[device-events] reconnect failed", err)
      scheduleReconnect(s)
    })
  }, delay)
}

async function connect(s: DeviceEventsState): Promise<void> {
  if (s.client) {
    await s.client.end().catch(() => {})
    s.client = null
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  await client.query("LISTEN device_state")
  client.on("notification", (msg) => {
    if (msg.channel === "device_state" && msg.payload) {
      s.emitter.emit("device", msg.payload)
    }
  })
  client.on("error", (err) => {
    console.warn("[device-events] PG client error", err)
    scheduleReconnect(s)
  })
  client.on("end", () => {
    console.warn("[device-events] PG client ended")
    scheduleReconnect(s)
  })
  s.client = client
  s.reconnectDelayMs = 1000
  console.info(`[device-events] PG listener connected (state id=${s._id})`)
}

let connectPromise: Promise<void> | null = null

function ensureConnected(s: DeviceEventsState): void {
  if (s.client || connectPromise) return
  connectPromise = connect(s)
    .catch((err) => {
      console.error("[device-events] initial connect failed", err)
      scheduleReconnect(s)
    })
    .finally(() => {
      connectPromise = null
    })
}

/**
 * Subscribe to device_state notifications. Returns an unsubscribe function.
 * Lazily connects the shared PG LISTEN client on first subscriber.
 */
export function subscribeDeviceState(listener: (deviceId: string) => void): () => void {
  const s = getState()
  s.emitter.on("device", listener)
  ensureConnected(s)
  return () => s.emitter.off("device", listener)
}

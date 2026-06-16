import mqtt, { type MqttClient } from "mqtt"
import { createHueClient } from "./hue.js"
import { createLumiBridge } from "./lumi.js"
import { buildServer } from "./server.js"
import { db, listLumiDevices } from "./state.js"
import { setupZigbee } from "./zigbee.js"

// Last-resort safety net: a forgotten event handler must not kill the bridge.
// PostgreSQL is the source of truth — state re-syncs on the next MQTT/Hue event.
process.on("unhandledRejection", (reason) => {
  console.error("[fatal-guard] unhandled rejection:", reason)
})
process.on("uncaughtException", (err) => {
  console.error("[fatal-guard] uncaught exception:", err)
})

const MQTT_CONNECT_TIMEOUT_MS = 10_000

function log(msg: string): void {
  console.log(`[boot] ${msg}`)
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`[boot] missing required env var: ${name}`)
    process.exit(1)
  }
  return value
}

function validateEnv(): {
  mqttUrl: string
  bridgeToken: string
  hueBridgeIp: string
  hueAppKey: string
  bridgePort: number
  huePollMs: number
} {
  const mqttUrl = requireEnv("MQTT_URL")
  const bridgeToken = requireEnv("BRIDGE_TOKEN")
  requireEnv("DATABASE_URL")

  return {
    mqttUrl,
    bridgeToken,
    hueBridgeIp: process.env.HUE_BRIDGE_IP ?? "",
    hueAppKey: process.env.HUE_APP_KEY ?? "",
    bridgePort: Number(process.env.BRIDGE_PORT ?? 4000),
    huePollMs: Number(process.env.HUE_POLL_MS ?? 30_000),
  }
}

function redactUrl(raw: string): string {
  try {
    const u = new URL(raw)
    return `${u.protocol}//${u.host}` // strip userinfo, path, query
  } catch {
    return "<unparseable url>" // never fall back to the raw value
  }
}

async function waitForMqttConnect(client: MqttClient, timeoutMs: number): Promise<void> {
  if (client.connected) return

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`MQTT connect timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    function cleanup() {
      clearTimeout(timer)
      client.removeListener("connect", onConnect)
      client.removeListener("error", onError)
    }

    function onConnect() {
      cleanup()
      resolve()
    }

    function onError(err: Error) {
      cleanup()
      reject(err)
    }

    client.on("connect", onConnect)
    client.on("error", onError)
  })
}

// Always-on bridge process: maintains MQTT + Hue connections and the in-memory
// DeviceRegistry, exposes the internal HTTP API (docs/bridge.md). Internal network
// only — never exposed through the external reverse-proxy (CLAUDE.md rule 5).
async function main() {
  log("validating env vars")
  const config = validateEnv()

  log(`connecting to MQTT broker at ${redactUrl(config.mqttUrl)}`)
  const mqttClient = mqtt.connect(config.mqttUrl)

  // Permanent listeners — must be registered before waitForMqttConnect so that
  // the EventEmitter never throws an unhandled 'error' event during boot.
  mqttClient.on("error", (err) => console.error("[mqtt] client error:", err.message))
  mqttClient.on("reconnect", () => log("MQTT reconnecting"))
  mqttClient.on("offline", () => log("MQTT offline"))

  try {
    await waitForMqttConnect(mqttClient, MQTT_CONNECT_TIMEOUT_MS)
    log("MQTT connected")
  } catch (err) {
    // Broker down ≠ bridge down: boot degraded, mqtt.js retries in background.
    // /health reports broker:false (503) until reconnected. Symmetric with b7dac83 for Hue.
    console.error("[boot] MQTT not connected at boot, continuing degraded:", err)
  }

  log("creating LUMI bridge")
  const lumi = createLumiBridge(mqttClient)

  log("hydrating DeviceRegistry from PostgreSQL")
  try {
    const devices = await listLumiDevices()
    lumi.hydrateRegistry(devices)
    log(`hydrated ${devices.length} LUMI device(s)`)
  } catch (err) {
    console.error("[boot] failed to hydrate registry from DB:", err)
    process.exit(1)
  }

  log("setting up Zigbee subscriptions")
  setupZigbee(mqttClient)

  log("creating Hue client")
  const hue = createHueClient(config.hueBridgeIp, config.hueAppKey)

  log("starting HTTP server")
  const app = buildServer({
    lumi,
    hue,
    mqttConnected: () => mqttClient.connected,
    token: config.bridgeToken,
  })

  const shutdown = async (signal: string) => {
    log(`received ${signal}, shutting down`)
    hue.stopPoll()
    await app.close()
    mqttClient.end()
    await db.$disconnect()
    process.exit(0)
  }

  process.on("SIGINT", () => void shutdown("SIGINT"))
  process.on("SIGTERM", () => void shutdown("SIGTERM"))

  await app.listen({ port: config.bridgePort, host: "0.0.0.0" })
  log(`listening on http://0.0.0.0:${config.bridgePort}`)

  // After listen — a slow/unreachable Hue Bridge must never block the
  // healthcheck (Hue Bridge down ≠ bridge down; the poll retries).
  hue
    .syncDevices()
    .then((count) => log(`synced ${count} Hue light(s)`))
    .catch((err) => console.error("[boot] Hue sync failed:", err))
  hue.startPoll(config.huePollMs)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

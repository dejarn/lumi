import mqtt, { type MqttClient } from "mqtt"
import { createHueClient } from "./hue.js"
import { createLumiBridge } from "./lumi.js"
import { buildServer } from "./server.js"
import { listLumiDevices } from "./state.js"
import { setupZigbee } from "./zigbee.js"

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
  hueBridgeIp: string
  hueAppKey: string
  bridgePort: number
  huePollMs: number
} {
  const mqttUrl = requireEnv("MQTT_URL")
  requireEnv("BRIDGE_TOKEN")
  requireEnv("DATABASE_URL")

  return {
    mqttUrl,
    hueBridgeIp: process.env.HUE_BRIDGE_IP ?? "",
    hueAppKey: process.env.HUE_APP_KEY ?? "",
    bridgePort: Number(process.env.BRIDGE_PORT ?? 4000),
    huePollMs: Number(process.env.HUE_POLL_MS ?? 30_000),
  }
}

async function waitForMqttConnect(client: MqttClient, timeoutMs: number): Promise<void> {
  if (client.connected) return

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      client.removeListener("connect", onConnect)
      reject(new Error(`MQTT connect timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    function onConnect() {
      clearTimeout(timer)
      client.removeListener("connect", onConnect)
      resolve()
    }

    client.on("connect", onConnect)
  })
}

// Always-on bridge process: maintains MQTT + Hue connections and the in-memory
// DeviceRegistry, exposes the internal HTTP API (docs/bridge.md). Internal network
// only — never exposed through Traefik (CLAUDE.md rule 5).
async function main() {
  log("validating env vars")
  const config = validateEnv()

  log(`connecting to MQTT broker at ${config.mqttUrl}`)
  const mqttClient = mqtt.connect(config.mqttUrl)

  try {
    await waitForMqttConnect(mqttClient, MQTT_CONNECT_TIMEOUT_MS)
  } catch (err) {
    console.error("[boot] MQTT connect failed:", err)
    process.exit(1)
  }
  log("MQTT connected")

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
  hue.startPoll(config.huePollMs)

  log("starting HTTP server")
  const app = buildServer({
    lumi,
    hue,
    mqttConnected: () => mqttClient.connected,
  })

  await app.listen({ port: config.bridgePort, host: "0.0.0.0" })
  log(`listening on http://0.0.0.0:${config.bridgePort}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

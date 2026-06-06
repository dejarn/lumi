import { buildServer } from "./server.js"
import { createLumiBridge } from "./lumi.js"
import { db } from "./state.js"

// Always-on bridge process: maintains MQTT + Hue connections and the in-memory
// DeviceRegistry, exposes the internal HTTP API (docs/bridge.md). Internal network
// only — never exposed through Traefik (CLAUDE.md rule 5).
async function main() {
  const port = Number(process.env.BRIDGE_PORT ?? 4000)

  // TODO: connect MQTT + Hue, hydrate registry from PostgreSQL, subscribe to
  // lumi/device/+/state, lumi/device/+/availability, lumi/discovery/announce,
  // and the Zigbee2MQTT topics.
  const lumi = createLumiBridge()
  void lumi
  void db

  const app = buildServer()
  await app.listen({ port, host: "0.0.0.0" })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

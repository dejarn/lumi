import Fastify, { type FastifyInstance } from "fastify"

// Internal HTTP API: Next.js → bridge. Per-device commands only — scene fan-out
// and trigger logic live in Next.js (docs/bridge.md). Guarded by BRIDGE_TOKEN.
export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: true })
  const token = process.env.BRIDGE_TOKEN ?? ""

  // Trust boundary: every route except /health requires the shared secret.
  app.addHook("onRequest", async (req, reply) => {
    if (req.url === "/health") return
    if (req.headers["x-bridge-token"] !== token) {
      reply.code(401).send({ error: "Unauthorized" })
    }
  })

  app.get("/health", async () => {
    // TODO: report broker + Hue + DB reachability.
    return { status: "ok" }
  })

  app.post("/command/:deviceId", async (req, reply) => {
    const { deviceId } = req.params as { deviceId: string }
    // TODO: route by device protocol —
    //   LUMI  → LumiClient.set* (await ACK 5s)
    //   HUE   → Hue REST v2
    //   ZIGBEE sensor → 422 (read-only)
    void deviceId
    reply.code(501).send({ error: "Not implemented" })
  })

  app.post("/zone/:deviceId", async (req, reply) => {
    const { deviceId } = req.params as { deviceId: string }
    // TODO: LUMI SET_ZONE.
    void deviceId
    reply.code(501).send({ error: "Not implemented" })
  })

  app.post("/discover", async (_req, reply) => {
    // TODO: broadcast DISCOVERY_REQUEST to all LUMI devices.
    reply.code(501).send({ error: "Not implemented" })
  })

  return app
}

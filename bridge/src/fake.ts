import { DeviceKind, Protocol } from "@prisma/client"
import Fastify from "fastify"
import { db, dbPing, getDevice, writeLightState } from "./state.js"

type CommandBody =
  | { type: "setPower"; on: boolean }
  | { type: "setBrightness"; brightness: number }
  | { type: "setColor"; hue: number; saturation: number; brightness: number }
  | { type: "setAnimation"; animId: number; speed: number; intensity: number }
  | { type: "stopAnimation" }

type ZoneBody = { zone: number }

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`[fake] missing required env var: ${name}`)
    process.exit(1)
  }
  return value
}

function isByte(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 255
}

function isHue(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 65535
}

function parseCommand(body: unknown): CommandBody | null {
  if (!body || typeof body !== "object" || !("type" in body)) return null
  const { type } = body as { type: string }

  switch (type) {
    case "setPower": {
      const { on } = body as { on?: unknown }
      if (typeof on !== "boolean") return null
      return { type: "setPower", on }
    }
    case "setBrightness": {
      const { brightness } = body as { brightness?: unknown }
      if (!isByte(brightness)) return null
      return { type: "setBrightness", brightness }
    }
    case "setColor": {
      const { hue, saturation, brightness } = body as {
        hue?: unknown
        saturation?: unknown
        brightness?: unknown
      }
      if (!isHue(hue) || !isByte(saturation) || !isByte(brightness)) return null
      return { type: "setColor", hue, saturation, brightness }
    }
    case "setAnimation": {
      const { animId, speed, intensity } = body as {
        animId?: unknown
        speed?: unknown
        intensity?: unknown
      }
      if (
        typeof animId !== "number" ||
        !Number.isInteger(animId) ||
        typeof speed !== "number" ||
        !Number.isInteger(speed) ||
        typeof intensity !== "number" ||
        !Number.isInteger(intensity)
      ) {
        return null
      }
      return { type: "setAnimation", animId, speed, intensity }
    }
    case "stopAnimation":
      return { type: "stopAnimation" }
    default:
      return null
  }
}

async function writeZone(deviceId: string, zone: number): Promise<void> {
  await db.device.update({ where: { id: deviceId }, data: { zone } })
  await db.$executeRaw`SELECT pg_notify('device_state', ${deviceId})`
}

async function main() {
  const token = requireEnv("BRIDGE_TOKEN")
  requireEnv("DATABASE_URL")
  const bridgePort = Number(process.env.BRIDGE_PORT ?? 4000)

  const app = Fastify({ logger: true })

  app.addHook("onRequest", async (req, reply) => {
    if (req.url === "/health") return
    if (req.headers["x-bridge-token"] !== token) {
      reply.code(401).send({ error: "Unauthorized" })
    }
  })

  app.get("/health", async (_req, reply) => {
    const dbOk = await dbPing()
      .then(() => true)
      .catch(() => false)
    reply.code(200).send({ broker: true, db: dbOk })
  })

  app.post("/command/:deviceId", async (req, reply) => {
    const { deviceId } = req.params as { deviceId: string }
    const device = await getDevice(deviceId)
    if (!device) {
      return reply.code(404).send({ error: "Device not found" })
    }

    if (device.kind === DeviceKind.SENSOR) {
      return reply.code(422).send({ error: "Sensors are read-only" })
    }

    if (device.protocol === Protocol.ZIGBEE) {
      return reply.code(422).send({ error: "Sensors are read-only" })
    }

    if (device.protocol === Protocol.HUE) {
      return reply.code(501).send({ error: "Hue not implemented" })
    }

    if (device.protocol !== Protocol.LUMI) {
      return reply.code(400).send({ error: "Unsupported protocol" })
    }

    const body = parseCommand(req.body)
    if (!body) {
      return reply.code(400).send({ error: "Invalid command type" })
    }

    try {
      switch (body.type) {
        case "setPower":
          await writeLightState(deviceId, { power: body.on })
          break
        case "setBrightness":
          await writeLightState(deviceId, { brightness: body.brightness })
          break
        case "setColor":
          await writeLightState(deviceId, {
            hue: body.hue,
            saturation: body.saturation,
            colorBrightness: body.brightness,
          })
          break
        case "setAnimation":
          await writeLightState(deviceId, {
            animId: body.animId,
            speed: body.speed,
            intensity: body.intensity,
          })
          break
        case "stopAnimation":
          await writeLightState(deviceId, { animId: 0 })
          break
      }
    } catch (err) {
      req.log.error(err, "writeLightState failed")
      return reply.code(500).send({ error: "Failed to write state" })
    }

    return reply.code(200).send({ ok: true })
  })

  app.post("/zone/:deviceId", async (req, reply) => {
    const { deviceId } = req.params as { deviceId: string }
    const device = await getDevice(deviceId)
    if (!device) {
      return reply.code(404).send({ error: "Device not found" })
    }

    if (device.protocol !== Protocol.LUMI) {
      return reply.code(422).send({ error: "SET_ZONE is LUMI only" })
    }

    const body = req.body as ZoneBody
    if (typeof body?.zone !== "number" || !Number.isInteger(body.zone)) {
      return reply.code(400).send({ error: "Invalid zone" })
    }

    try {
      await writeZone(deviceId, body.zone)
    } catch (err) {
      req.log.error(err, "writeZone failed")
      return reply.code(500).send({ error: "Failed to write zone" })
    }

    return reply.code(200).send({ ok: true })
  })

  app.post("/discover", async (req, reply) => {
    req.log.info("discover requested (no-op in fake-bridge)")
    return reply.code(202).send({ ok: true })
  })

  await app.listen({ port: bridgePort, host: "0.0.0.0" })
  console.log(`[fake] listening on http://0.0.0.0:${bridgePort}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

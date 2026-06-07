import { DeviceKind, Protocol } from "@prisma/client"
import Fastify, { type FastifyInstance } from "fastify"
import type { HueClient } from "./hue.js"
import { type LumiBridge, LumiTimeoutError } from "./lumi.js"
import { dbPing, getDevice } from "./state.js"

type CommandBody =
  | { type: "setPower"; on: boolean }
  | { type: "setBrightness"; brightness: number }
  | { type: "setColor"; hue: number; saturation: number; brightness: number }
  | { type: "setAnimation"; animId: number; speed: number; intensity: number }
  | { type: "stopAnimation" }

type ZoneBody = { zone: number }

export function buildServer(deps: {
  lumi: LumiBridge
  hue: HueClient
  mqttConnected: () => boolean
}): FastifyInstance {
  const app = Fastify({ logger: true })
  const token = process.env.BRIDGE_TOKEN ?? ""

  // Trust boundary: every route except /health requires the shared secret.
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
    const brokerOk = deps.mqttConnected()
    const ok = dbOk && brokerOk
    reply.code(ok ? 200 : 503).send({ broker: brokerOk, db: dbOk })
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

    switch (device.protocol) {
      case Protocol.LUMI: {
        const body = req.body as CommandBody
        try {
          switch (body.type) {
            case "setPower":
              await deps.lumi.setPower(device.externalId, body.on)
              break
            case "setBrightness":
              await deps.lumi.setBrightness(device.externalId, body.brightness)
              break
            case "setColor":
              await deps.lumi.setColor(
                device.externalId,
                body.hue,
                body.saturation,
                body.brightness,
              )
              break
            case "setAnimation":
              await deps.lumi.setAnimation(
                device.externalId,
                body.animId,
                body.speed,
                body.intensity,
              )
              break
            case "stopAnimation":
              await deps.lumi.stopAnimation(device.externalId)
              break
            default:
              return reply.code(400).send({ error: "Invalid command type" })
          }
        } catch (err) {
          if (err instanceof LumiTimeoutError) {
            return reply.code(502).send({ error: "ACK timeout" })
          }
          throw err
        }
        return reply.code(200).send({ ok: true })
      }

      case Protocol.HUE:
        return reply.code(501).send({ error: "Hue not implemented" })

      case Protocol.ZIGBEE:
        return reply.code(422).send({ error: "Sensors are read-only" })

      default:
        return reply.code(400).send({ error: "Unsupported protocol" })
    }
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
    try {
      await deps.lumi.setZone(device.externalId, body.zone)
    } catch (err) {
      if (err instanceof LumiTimeoutError) {
        return reply.code(502).send({ error: "ACK timeout" })
      }
      throw err
    }
    return reply.code(200).send({ ok: true })
  })

  app.post("/discover", async (_req, reply) => {
    await deps.lumi.discover()
    return reply.code(202).send({ ok: true })
  })

  return app
}

import { DeviceKind, Protocol } from "@prisma/client"
import Fastify, { type FastifyInstance } from "fastify"
import { makeAuthHook } from "./auth-hook.js"
import { parseCommand, type CommandBody } from "./command.js"
import { commandToHue, HueApiError, type HueClient } from "./hue.js"
import { type LumiBridge, LumiTimeoutError } from "./lumi.js"
import { dbPing, getDevice } from "./state.js"

type ZoneBody = { zone: number }

export function buildServer(deps: {
  lumi: LumiBridge
  hue: HueClient
  mqttConnected: () => boolean
  token: string
}): FastifyInstance {
  const app = Fastify({ logger: true })

  app.addHook("onRequest", makeAuthHook(deps.token))

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

    const body = parseCommand(req.body)
    if (!body) {
      return reply.code(400).send({ error: "Invalid command body" })
    }

    switch (device.protocol) {
      case Protocol.LUMI: {
        try {
          await dispatchLumiCommand(deps.lumi, device.externalId, body)
        } catch (err) {
          if (err instanceof LumiTimeoutError) {
            return reply.code(502).send({ error: "ACK timeout" })
          }
          throw err
        }
        return reply.code(200).send({ ok: true })
      }

      case Protocol.HUE: {
        const hueCmd = commandToHue(body)
        if (!hueCmd) {
          return reply.code(422).send({ error: "Animations are LUMI only" })
        }
        try {
          await deps.hue.setLight(device.externalId, hueCmd)
        } catch (err) {
          if (err instanceof HueApiError) {
            return reply.code(502).send({ error: err.message })
          }
          throw err
        }
        return reply.code(200).send({ ok: true })
      }

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

    const zoneBody = req.body as ZoneBody
    if (
      !zoneBody ||
      typeof zoneBody.zone !== "number" ||
      !Number.isInteger(zoneBody.zone) ||
      zoneBody.zone < 0 ||
      zoneBody.zone > 255
    ) {
      return reply.code(400).send({ error: "Invalid zone" })
    }

    try {
      await deps.lumi.setZone(device.externalId, zoneBody.zone)
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
    // Hue sweep is fire-and-forget — discovery stays 202/best-effort.
    deps.hue.syncDevices().catch((err: unknown) => {
      app.log.error({ err }, "hue discovery sync failed")
    })
    return reply.code(202).send({ ok: true })
  })

  return app
}

async function dispatchLumiCommand(
  lumi: LumiBridge,
  externalId: string,
  body: CommandBody,
): Promise<void> {
  switch (body.type) {
    case "setPower":
      await lumi.setPower(externalId, body.on)
      break
    case "setBrightness":
      await lumi.setBrightness(externalId, body.brightness)
      break
    case "setColor":
      await lumi.setColor(externalId, body.hue, body.saturation, body.brightness)
      break
    case "setAnimation":
      await lumi.setAnimation(externalId, body.animId, body.speed, body.intensity)
      break
    case "stopAnimation":
      await lumi.stopAnimation(externalId)
      break
  }
}

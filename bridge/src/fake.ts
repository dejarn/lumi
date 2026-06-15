import { DeviceKind, Protocol } from "@prisma/client"
import Fastify from "fastify"
import { makeAuthHook } from "./auth-hook.js"
import { parseCommand } from "./command.js"
import {
  db,
  dbPing,
  getDevice,
  writeLightState,
  writeSensorState,
  writeZone,
} from "./state.js"

type ZoneBody = { zone: number }
type SensorBody = { active: boolean }

let sensorSimInterval: ReturnType<typeof setInterval> | null = null

async function flipAllSensors(): Promise<void> {
  const sensors = await db.device.findMany({
    where: { kind: DeviceKind.SENSOR },
    select: { id: true, sensorActive: true },
  })
  if (sensors.length === 0) return

  await Promise.all(
    sensors.map((s) => writeSensorState(s.id, !s.sensorActive)),
  )
}

function startSensorSimulator(ms: number, log: (msg: string) => void): void {
  if (sensorSimInterval) return
  log(`sensor simulator enabled (interval ${ms}ms)`)
  sensorSimInterval = setInterval(() => {
    flipAllSensors().catch((err) => console.error("[fake] sensor sim tick failed:", err))
  }, ms)
}

function stopSensorSimulator(): void {
  if (!sensorSimInterval) return
  clearInterval(sensorSimInterval)
  sensorSimInterval = null
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`[fake] missing required env var: ${name}`)
    process.exit(1)
  }
  return value
}

async function main() {
  const token = requireEnv("BRIDGE_TOKEN")
  requireEnv("DATABASE_URL")
  const bridgePort = Number(process.env.BRIDGE_PORT ?? 4000)

  const app = Fastify({ logger: true })

  app.addHook("onRequest", makeAuthHook(token))

  app.get("/health", async (_req, reply) => {
    const dbOk = await dbPing()
      .then(() => true)
      .catch(() => false)
    reply.code(dbOk ? 200 : 503).send({ broker: true, db: dbOk })
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
    if (
      !body ||
      typeof body.zone !== "number" ||
      !Number.isInteger(body.zone) ||
      body.zone < 0 ||
      body.zone > 255
    ) {
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

  app.post("/fake/sensor/:deviceId", async (req, reply) => {
    const { deviceId } = req.params as { deviceId: string }
    const device = await getDevice(deviceId)
    if (!device) {
      return reply.code(404).send({ error: "Device not found" })
    }

    const body = req.body as SensorBody
    if (typeof body?.active !== "boolean") {
      return reply.code(400).send({ error: "Invalid active" })
    }

    try {
      await writeSensorState(deviceId, body.active)
    } catch (err) {
      req.log.error(err, "writeSensorState failed")
      return reply.code(500).send({ error: "Failed to write state" })
    }

    return reply.code(200).send({ ok: true })
  })

  const fakeSensorMs = Number(process.env.FAKE_SENSOR_MS ?? 0)
  if (fakeSensorMs > 0) {
    startSensorSimulator(fakeSensorMs, (msg) => app.log.info(msg))
  }

  const shutdown = async (signal: string) => {
    app.log.info(`received ${signal}, shutting down`)
    stopSensorSimulator()
    await app.close()
    process.exit(0)
  }

  process.on("SIGINT", () => void shutdown("SIGINT"))
  process.on("SIGTERM", () => void shutdown("SIGTERM"))
  app.addHook("onClose", async () => {
    stopSensorSimulator()
  })

  await app.listen({ port: bridgePort, host: "0.0.0.0" })
  console.log(`[fake] listening on http://0.0.0.0:${bridgePort}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

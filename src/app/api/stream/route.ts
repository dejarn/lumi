import { NextRequest } from "next/server"
import { Client } from "pg"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { DeviceStatePatch } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/stream — a single global SSE stream of live device state (USER).
// The bridge issues `NOTIFY device_state, '<deviceId>'` after every state write;
// this handler holds a dedicated PG connection doing `LISTEN device_state`, reads
// the row, and pushes a `device-state` patch (docs/bridge.md, docs/api.md#stream-sse).
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (patch: DeviceStatePatch) => {
        controller.enqueue(encoder.encode(`event: device-state\ndata: ${JSON.stringify(patch)}\n\n`))
      }

      const client = new Client({ connectionString: process.env.DATABASE_URL })
      await client.connect()
      await client.query("LISTEN device_state")

      client.on("notification", async (msg) => {
        const deviceId = msg.payload
        if (!deviceId) return
        const device = await prisma.device.findUnique({ where: { id: deviceId } })
        if (!device) return
        send(toPatch(device))
      })

      // Keep-alive comment every 25s so proxies don't drop the connection.
      const keepAlive = setInterval(() => controller.enqueue(encoder.encode(": ping\n\n")), 25_000)

      req.signal.addEventListener("abort", async () => {
        clearInterval(keepAlive)
        await client.end().catch(() => {})
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}

type DeviceRow = Awaited<ReturnType<typeof prisma.device.findUnique>>

function toPatch(device: NonNullable<DeviceRow>): DeviceStatePatch {
  if (device.kind === "SENSOR") {
    return {
      deviceId: device.id,
      reachable: device.reachable,
      sensorActive: device.sensorActive ?? undefined,
    }
  }
  return {
    deviceId: device.id,
    reachable: device.reachable,
    power: device.power ?? undefined,
    brightness: device.brightness ?? undefined,
    hue: device.hue ?? undefined,
    saturation: device.saturation ?? undefined,
    colorBrightness: device.colorBrightness ?? undefined,
    animId: device.animId ?? undefined,
  }
}

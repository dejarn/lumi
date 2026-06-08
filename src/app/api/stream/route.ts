import { NextRequest } from "next/server"
import { Client } from "pg"
import { requireUser, isResponse } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import type { DeviceStatePatch } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/stream — a single global SSE stream of live device state (USER).
// The bridge issues `NOTIFY device_state, '<deviceId>'` after every state write;
// this handler holds a dedicated PG connection doing `LISTEN device_state`, reads
// the row, and pushes a `device-state` patch (docs/bridge.md, docs/api.md#stream-sse).
export async function GET(req: NextRequest) {
  const user = await requireUser()
  if (isResponse(user)) return user

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const client = new Client({ connectionString: process.env.DATABASE_URL })
      let keepAlive: ReturnType<typeof setInterval> | undefined
      let cleaned = false

      const cleanup = async () => {
        if (cleaned) return
        cleaned = true
        if (keepAlive) clearInterval(keepAlive)
        await client.end().catch(() => {})
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }

      const send = (patch: DeviceStatePatch) => {
        controller.enqueue(encoder.encode(`event: device-state\ndata: ${JSON.stringify(patch)}\n\n`))
      }

      try {
        await client.connect()
        await client.query("LISTEN device_state")

        client.on("notification", (msg) => {
          void (async () => {
            try {
              const deviceId = msg.payload
              if (!deviceId) return
              const device = await prisma.device.findUnique({ where: { id: deviceId } })
              if (!device) return
              send(toPatch(device))
            } catch (err) {
              console.error("[stream] notification handler error", err)
            }
          })()
        })

        client.on("error", (err) => {
          console.error("[stream] PG client error", err)
          void cleanup()
        })

        client.on("end", () => {
          void cleanup()
        })

        keepAlive = setInterval(() => controller.enqueue(encoder.encode(": ping\n\n")), 25_000)

        req.signal.addEventListener("abort", () => {
          void cleanup()
        })
      } catch (err) {
        await client.end().catch(() => {})
        controller.error(err)
      }
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
    animSpeed: device.animSpeed ?? undefined,
    animIntensity: device.animIntensity ?? undefined,
  }
}

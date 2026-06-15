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
        // M5: check abort before connecting, register handler before connect()
        if (req.signal.aborted) {
          await cleanup()
          return
        }
        req.signal.addEventListener("abort", () => {
          void cleanup()
        })

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

        // H2: piggyback User.active recheck on keep-alive (CLAUDE.md rule 3).
        // A revoked user's stream closes within 25 s; the EventSource reconnect
        // will then receive 401 from requireUser(). Also covers L7: enqueue on
        // an errored controller throws — the catch calls cleanup() instead of
        // leaving an uncaught exception.
        keepAlive = setInterval(() => {
          void (async () => {
            try {
              const u = await prisma.user.findUnique({
                where: { id: user.id },
                select: { active: true },
              })
              if (!u || !u.active) {
                // Revocation: cut the stream immediately.
                await cleanup()
                return
              }
              controller.enqueue(encoder.encode(": ping\n\n"))
            } catch {
              void cleanup()
            }
          })()
        }, 25_000)
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

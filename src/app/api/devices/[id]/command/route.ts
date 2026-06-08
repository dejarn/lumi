import { NextRequest, NextResponse } from "next/server"
import { requireUser, isResponse } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { sendCommand } from "@/lib/bridge-client"
import type { DeviceCommand } from "@/lib/types"

type Params = { params: Promise<{ id: string }> }

export const runtime = "nodejs"

function resolveDeviceId(req: NextRequest, paramId: string | undefined): string {
  const fromParams = paramId?.trim()
  if (fromParams) return fromParams
  const fromPath = req.nextUrl.pathname.match(/\/api\/devices\/([^/]+)\/command\/?$/)?.[1]
  return fromPath?.trim() ?? ""
}

// POST /api/devices/[id]/command — control a light (USER). Returns 202; the
// confirmed state arrives via SSE. 422 on a SENSOR. Best-effort (CLAUDE.md rule 2).
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireUser()
  if (isResponse(auth)) return auth

  const { id: paramId } = await params
  const id = resolveDeviceId(req, paramId)
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const device = await prisma.device.findUnique({ where: { id } })
  if (!device) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (device.kind !== "LIGHT") {
    return NextResponse.json({ error: "Not a controllable light" }, { status: 422 })
  }

  const command = (await req.json()) as DeviceCommand
  function isUint8(n: unknown): n is number {
    return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 255
  }
  const cmd = command as Record<string, unknown>
  if (cmd.type === "power") {
    if (typeof cmd.on !== "boolean")
      return NextResponse.json({ error: "power requires boolean 'on'" }, { status: 422 })
  } else if (cmd.type === "brightness") {
    if (!isUint8(cmd.brightness))
      return NextResponse.json({ error: "brightness must be 0–255" }, { status: 422 })
  } else if (cmd.type === "color") {
    if (typeof cmd.hue !== "number" || !Number.isInteger(cmd.hue) || cmd.hue < 0 || cmd.hue > 65535)
      return NextResponse.json({ error: "hue must be 0–65535" }, { status: 422 })
    if (!isUint8(cmd.saturation) || !isUint8(cmd.brightness))
      return NextResponse.json({ error: "saturation and brightness must be 0–255" }, { status: 422 })
  } else if (cmd.type === "animation") {
    if (!isUint8(cmd.animId) || !isUint8(cmd.speed) || !isUint8(cmd.intensity))
      return NextResponse.json({ error: "animId, speed, intensity must be 0–255" }, { status: 422 })
  } else if (cmd.type !== "stopAnimation") {
    return NextResponse.json({ error: `Unknown command type: ${String(cmd.type)}` }, { status: 422 })
  }
  const res = await sendCommand(id, command)
  if (!res.ok) return NextResponse.json({ error: "Bridge error" }, { status: 502 })

  return new NextResponse(null, { status: 202 })
}

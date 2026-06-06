import { NextRequest, NextResponse } from "next/server"
import { requireUser, isResponse } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { sendCommand } from "@/lib/bridge-client"
import type { DeviceCommand } from "@/lib/types"

type Params = { params: Promise<{ id: string }> }

// POST /api/devices/[id]/command — control a light (USER). Returns 202; the
// confirmed state arrives via SSE. 422 on a SENSOR. Best-effort (CLAUDE.md rule 2).
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireUser()
  if (isResponse(auth)) return auth

  const { id } = await params
  const device = await prisma.device.findUnique({ where: { id } })
  if (!device) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (device.kind !== "LIGHT") {
    return NextResponse.json({ error: "Not a controllable light" }, { status: 422 })
  }

  const command = (await req.json()) as DeviceCommand
  // TODO: validate command shape + field ranges (hue 0–65535, rest 0–255).
  const res = await sendCommand(id, command)
  if (!res.ok) return NextResponse.json({ error: "Bridge error" }, { status: 502 })

  return new NextResponse(null, { status: 202 })
}

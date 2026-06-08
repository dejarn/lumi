import { NextRequest, NextResponse } from "next/server"
import { requireAdmin, isResponse } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { setZone } from "@/lib/bridge-client"

type Params = { params: Promise<{ id: string }> }

// POST /api/devices/[id]/zone — LUMI only, sends SET_ZONE (ADMIN). 422 for HUE/ZIGBEE.
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin()
  if (isResponse(auth)) return auth

  const { id } = await params
  const device = await prisma.device.findUnique({ where: { id } })
  if (!device) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (device.protocol !== "LUMI") {
    return NextResponse.json({ error: "Zone is LUMI-only" }, { status: 422 })
  }

  const body = await req.json().catch(() => null)
  if (body === null) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  const { zone } = body
  if (!Number.isInteger(zone) || zone < 0 || zone > 255) {
    return NextResponse.json({ error: "Invalid zone" }, { status: 400 })
  }

  const res = await setZone(id, zone)
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: "Bridge error" }))
    return NextResponse.json(errBody, { status: res.status })
  }
  return new NextResponse(null, { status: 202 })
}

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

  const { zone } = await req.json()
  if (!Number.isInteger(zone)) return NextResponse.json({ error: "Invalid zone" }, { status: 400 })

  const res = await setZone(id, zone)
  if (!res.ok) return NextResponse.json({ error: "Bridge error" }, { status: 502 })
  return new NextResponse(null, { status: 202 })
}

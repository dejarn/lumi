import { NextRequest, NextResponse } from "next/server"
import { requireAdmin, isResponse } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"

type Params = { params: Promise<{ id: string }> }

// POST /api/scenes/[id]/capture — replace scene membership with the given lights,
// snapshotting each device's CURRENT DB state (ADMIN). Only LIGHT devices; SENSOR → 422.
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin()
  if (isResponse(auth)) return auth

  const { id } = await params
  const { deviceIds } = await req.json()
  if (!Array.isArray(deviceIds)) {
    return NextResponse.json({ error: "deviceIds required" }, { status: 400 })
  }

  const devices = await prisma.device.findMany({
    where: { id: { in: deviceIds } },
    select: { id: true, kind: true, power: true, brightness: true, hue: true,
              saturation: true, colorBrightness: true, animId: true },
  })
  if (devices.length !== deviceIds.length)
    return NextResponse.json({ error: "One or more devices not found" }, { status: 404 })
  if (devices.some((d) => d.kind === "SENSOR"))
    return NextResponse.json({ error: "SENSOR devices cannot be captured" }, { status: 422 })

  const scene = await prisma.scene.findUnique({ where: { id }, select: { id: true } })
  if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 })

  const data = devices.map((d) => ({
    sceneId: id,
    deviceId: d.id,
    power: d.power ?? false,
    brightness: d.brightness ?? 0,
    hue: d.hue ?? 0,
    saturation: d.saturation ?? 0,
    colorBrightness: d.colorBrightness ?? 0,
    animId: d.animId ?? 0,
  }))

  const captured = await prisma.$transaction(async (tx) => {
    await tx.sceneDevice.deleteMany({ where: { sceneId: id } })
    if (data.length > 0) {
      await tx.sceneDevice.createMany({ data })
    }
    return tx.sceneDevice.findMany({ where: { sceneId: id }, orderBy: { deviceId: "asc" } })
  })

  return NextResponse.json(captured)
}

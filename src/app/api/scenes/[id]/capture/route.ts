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
  const body = await req.json().catch(() => null)
  const rawIds = body && typeof body === "object" ? (body as { deviceIds?: unknown }).deviceIds : undefined
  if (!Array.isArray(rawIds) || !rawIds.every((d): d is string => typeof d === "string")) {
    return NextResponse.json({ error: "deviceIds must be an array of strings" }, { status: 400 })
  }
  const deviceIds = [...new Set(rawIds)]

  const devices = await prisma.device.findMany({
    where: { id: { in: deviceIds } },
    select: { id: true, kind: true, power: true, brightness: true, hue: true,
              saturation: true, colorBrightness: true, animId: true,
              animSpeed: true, animIntensity: true },
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
    animSpeed: d.animSpeed ?? 128,
    animIntensity: d.animIntensity ?? 200,
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

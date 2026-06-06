import { NextRequest, NextResponse } from "next/server"
import { requireUser, requireAdmin, isResponse } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"

type Params = { params: Promise<{ id: string }> }

// GET /api/scenes/[id] — scene with its saved device states (USER)
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireUser()
  if (isResponse(auth)) return auth

  const { id } = await params
  const scene = await prisma.scene.findUnique({
    where: { id },
    include: { sceneDevices: true },
  })
  if (!scene) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({
    id: scene.id,
    name: scene.name,
    devices: scene.sceneDevices.map((d) => ({
      deviceId: d.deviceId,
      power: d.power,
      brightness: d.brightness,
      hue: d.hue,
      saturation: d.saturation,
      colorBrightness: d.colorBrightness,
      animId: d.animId,
    })),
  })
}

// PATCH /api/scenes/[id] — rename (ADMIN)
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin()
  if (isResponse(auth)) return auth

  const { id } = await params
  const { name } = await req.json()
  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 })
  }
  const scene = await prisma.scene.update({ where: { id }, data: { name: name.trim() } })
  return NextResponse.json(scene)
}

// DELETE /api/scenes/[id] (ADMIN) — cascades to SceneDevice + Trigger rows.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin()
  if (isResponse(auth)) return auth

  const { id } = await params
  await prisma.scene.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}

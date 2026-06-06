import { NextRequest, NextResponse } from "next/server"
import { requireUser, requireAdmin, isResponse } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { reloadCronJobs } from "@/lib/automation/scheduler"

type Params = { params: Promise<{ id: string }> }

// GET /api/devices/[id] (USER)
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireUser()
  if (isResponse(auth)) return auth

  const { id } = await params
  const device = await prisma.device.findUnique({ where: { id } })
  if (!device) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(device)
}

// PATCH /api/devices/[id] — rename (ADMIN)
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin()
  if (isResponse(auth)) return auth

  const { id } = await params
  const { name } = await req.json()
  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 })
  }
  const device = await prisma.device.update({ where: { id }, data: { name: name.trim() } })
  return NextResponse.json(device)
}

// DELETE /api/devices/[id] — remove a stale device (ADMIN)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin()
  if (isResponse(auth)) return auth

  const { id } = await params
  await prisma.$transaction([
    prisma.trigger.updateMany({ where: { sensorDeviceId: id }, data: { enabled: false } }),
    prisma.device.delete({ where: { id } }),
  ])
  await reloadCronJobs()
  return new NextResponse(null, { status: 204 })
}

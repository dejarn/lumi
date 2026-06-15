import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { requireUser, requireAdmin, isResponse } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { toDeviceDto } from "@/lib/device-dto"

type Params = { params: Promise<{ id: string }> }

// GET /api/devices/[id] (USER)
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireUser()
  if (isResponse(auth)) return auth

  const { id } = await params
  const device = await prisma.device.findUnique({ where: { id } })
  if (!device) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(toDeviceDto(device))
}

// PATCH /api/devices/[id] — rename (ADMIN)
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin()
  if (isResponse(auth)) return auth

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (body === null) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  const { name } = body
  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 })
  }
  try {
    const device = await prisma.device.update({ where: { id }, data: { name: name.trim() } })
    return NextResponse.json(device)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    throw e
  }
}

// DELETE /api/devices/[id] — remove a stale device (ADMIN)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin()
  if (isResponse(auth)) return auth

  const { id } = await params
  try {
    await prisma.$transaction([
      prisma.trigger.updateMany({ where: { sensorDeviceId: id }, data: { enabled: false } }),
      prisma.device.delete({ where: { id } }),
    ])
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    throw e
  }
  // No reloadCronJobs() needed: the transaction sets enabled=false on SENSOR triggers
  // referencing this device; the scheduler picks this up on next evaluation (no CRON jobs affected).
  return new NextResponse(null, { status: 204 })
}

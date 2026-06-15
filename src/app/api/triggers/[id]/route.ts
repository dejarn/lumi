import cron from "node-cron"
import { NextRequest, NextResponse } from "next/server"
import { requireUser, requireAdmin, isResponse } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { reloadCronJobs } from "@/lib/automation/scheduler"

type Params = { params: Promise<{ id: string }> }

// PATCH /api/triggers/[id] — partial update; USER may toggle enabled only.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (body === null) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })

  const onlyEnabled =
    typeof body === "object" &&
    body !== null &&
    Object.keys(body).length === 1 &&
    typeof body.enabled === "boolean"

  if (onlyEnabled) {
    const auth = await requireUser()
    if (isResponse(auth)) return auth
  } else {
    const auth = await requireAdmin()
    if (isResponse(auth)) return auth
  }

  const existing = await prisma.trigger.findUnique({ where: { id }, select: { type: true } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const data: {
    enabled?: boolean
    name?: string
    cronExpr?: string
    sensorDeviceId?: string
    sensorState?: boolean
  } = {}
  if (typeof body.enabled === "boolean") data.enabled = body.enabled
  if (typeof body.name === "string") {
    const n = body.name.trim()
    if (!n) return NextResponse.json({ error: "name must be non-empty" }, { status: 422 })
    data.name = n
  }

  if (existing.type === "CRON") {
    if (body.sensorDeviceId != null || body.sensorState != null)
      return NextResponse.json({ error: "Cannot set sensor fields on CRON trigger" }, { status: 422 })
    if (body.cronExpr !== undefined) {
      if (typeof body.cronExpr !== "string" || !body.cronExpr.trim())
        return NextResponse.json({ error: "cronExpr must be non-empty" }, { status: 422 })
      const expr = body.cronExpr.trim()
      if (!cron.validate(expr)) {
        return NextResponse.json({ error: "invalid cronExpr" }, { status: 422 })
      }
      data.cronExpr = expr
    }
  } else {
    if (body.cronExpr != null)
      return NextResponse.json({ error: "Cannot set cronExpr on SENSOR trigger" }, { status: 422 })
    if (body.sensorDeviceId !== undefined) {
      if (typeof body.sensorDeviceId !== "string")
        return NextResponse.json({ error: "sensorDeviceId must be a string" }, { status: 422 })
      const sensor = await prisma.device.findUnique({ where: { id: body.sensorDeviceId }, select: { kind: true } })
      if (!sensor) return NextResponse.json({ error: "sensorDevice not found" }, { status: 422 })
      if (sensor.kind !== "SENSOR") return NextResponse.json({ error: "Device is not a SENSOR" }, { status: 422 })
      data.sensorDeviceId = body.sensorDeviceId
    }
    if (body.sensorState !== undefined) {
      if (typeof body.sensorState !== "boolean")
        return NextResponse.json({ error: "sensorState must be boolean" }, { status: 422 })
      data.sensorState = body.sensorState
    }
  }

  const trigger = await prisma.trigger.update({ where: { id }, data })
  if (existing.type === "CRON") await reloadCronJobs()
  return NextResponse.json(trigger)
}

// DELETE /api/triggers/[id] (ADMIN)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin()
  if (isResponse(auth)) return auth

  const { id } = await params
  const existing = await prisma.trigger.findUnique({ where: { id }, select: { type: true } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.trigger.delete({ where: { id } })
  if (existing.type === "CRON") await reloadCronJobs()
  return new NextResponse(null, { status: 204 })
}

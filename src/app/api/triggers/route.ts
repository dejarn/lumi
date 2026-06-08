import cron from "node-cron"
import { NextRequest, NextResponse } from "next/server"
import { requireUser, requireAdmin, isResponse } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { reloadCronJobs } from "@/lib/automation/scheduler"

// GET /api/triggers — list (USER)
export async function GET() {
  const auth = await requireUser()
  if (isResponse(auth)) return auth

  const triggers = await prisma.trigger.findMany({ orderBy: { name: "asc" } })
  return NextResponse.json(triggers)
}

// POST /api/triggers — create, discriminated by type (ADMIN).
// CRON requires cronExpr; SENSOR requires sensorDeviceId + sensorState. Mismatch → 422.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (isResponse(auth)) return auth

  const body = await req.json().catch(() => null)
  if (body === null) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  const { name, type, sceneId, cronExpr, sensorDeviceId, sensorState, enabled } = body

  if (typeof name !== "string" || !name.trim())
    return NextResponse.json({ error: "name required" }, { status: 422 })
  if (typeof sceneId !== "string" || !sceneId)
    return NextResponse.json({ error: "sceneId required" }, { status: 422 })

  const scene = await prisma.scene.findUnique({ where: { id: sceneId }, select: { id: true } })
  if (!scene) return NextResponse.json({ error: "scene not found" }, { status: 404 })

  if (type === "CRON") {
    if (typeof cronExpr !== "string" || !cronExpr.trim())
      return NextResponse.json({ error: "cronExpr required for CRON trigger" }, { status: 422 })
    if (!cron.validate(cronExpr.trim()))
      return NextResponse.json({ error: "invalid cronExpr" }, { status: 422 })
    if (sensorDeviceId != null || sensorState != null)
      return NextResponse.json({ error: "sensorDeviceId/sensorState not allowed on CRON" }, { status: 422 })
    const trigger = await prisma.trigger.create({
      data: { name: name.trim(), type: "CRON", cronExpr: cronExpr.trim(), sceneId, enabled: enabled ?? true },
    })
    await reloadCronJobs()
    return NextResponse.json(trigger, { status: 201 })
  }

  if (type === "SENSOR") {
    if (typeof sensorDeviceId !== "string" || !sensorDeviceId)
      return NextResponse.json({ error: "sensorDeviceId required for SENSOR trigger" }, { status: 422 })
    if (typeof sensorState !== "boolean")
      return NextResponse.json({ error: "sensorState (boolean) required for SENSOR trigger" }, { status: 422 })
    if (cronExpr != null)
      return NextResponse.json({ error: "cronExpr not allowed on SENSOR trigger" }, { status: 422 })
    const sensor = await prisma.device.findUnique({ where: { id: sensorDeviceId }, select: { kind: true } })
    if (!sensor) return NextResponse.json({ error: "sensorDevice not found" }, { status: 422 })
    if (sensor.kind !== "SENSOR") return NextResponse.json({ error: "Device is not a SENSOR" }, { status: 422 })
    const trigger = await prisma.trigger.create({
      data: { name: name.trim(), type: "SENSOR", sensorDeviceId, sensorState, sceneId, enabled: enabled ?? true },
    })
    return NextResponse.json(trigger, { status: 201 })
  }

  return NextResponse.json({ error: "type must be CRON or SENSOR" }, { status: 422 })
}

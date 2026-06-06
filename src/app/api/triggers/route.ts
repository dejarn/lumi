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

  const body = await req.json()
  // TODO: validate type invariants (CRON vs SENSOR fields), verify sensorDeviceId
  // references a SENSOR device, then prisma.trigger.create + reloadCronJobs().
  void body
  await reloadCronJobs()
  return NextResponse.json({ error: "Not implemented" }, { status: 501 })
}

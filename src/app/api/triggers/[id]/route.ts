import { NextRequest, NextResponse } from "next/server"
import { requireAdmin, isResponse } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { reloadCronJobs } from "@/lib/automation/scheduler"

type Params = { params: Promise<{ id: string }> }

// PATCH /api/triggers/[id] — partial update, e.g. enable/disable (ADMIN).
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin()
  if (isResponse(auth)) return auth

  const { id } = await params
  const body = await req.json()
  const data: { enabled?: boolean; name?: string } = {}
  if (typeof body.enabled === "boolean") data.enabled = body.enabled
  if (typeof body.name === "string") data.name = body.name.trim()
  // TODO: support cronExpr / sensor fields with type-invariant validation.

  const trigger = await prisma.trigger.update({ where: { id }, data })
  await reloadCronJobs()
  return NextResponse.json(trigger)
}

// DELETE /api/triggers/[id] (ADMIN)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin()
  if (isResponse(auth)) return auth

  const { id } = await params
  await prisma.trigger.delete({ where: { id } })
  await reloadCronJobs()
  return new NextResponse(null, { status: 204 })
}

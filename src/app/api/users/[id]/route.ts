import { NextRequest, NextResponse } from "next/server"
import { requireAdmin, isResponse } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"

type Params = { params: Promise<{ id: string }> }

// PATCH /api/users/[id] — update role or active (ADMIN). Setting active:false
// revokes access at the next request (CLAUDE.md rule 3).
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin()
  if (isResponse(auth)) return auth

  const { id } = await params
  const body = await req.json()
  const data: { role?: "ADMIN" | "USER"; active?: boolean } = {}
  if (body.role === "ADMIN" || body.role === "USER") data.role = body.role
  if (typeof body.active === "boolean") data.active = body.active

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, username: true, role: true, active: true, createdAt: true },
  })
  return NextResponse.json(user)
}

// DELETE /api/users/[id] (ADMIN)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin()
  if (isResponse(auth)) return auth

  const { id } = await params
  await prisma.user.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}

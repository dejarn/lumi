import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { requireAdmin, isResponse } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"

type Params = { params: Promise<{ id: string }> }

// PATCH /api/users/[id] — update role or active (ADMIN). Setting active:false
// revokes access at the next request (CLAUDE.md rule 3).
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin()
  if (isResponse(auth)) return auth

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (body === null) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })

  const data: { role?: "ADMIN" | "USER"; active?: boolean } = {}
  if (body.role === "ADMIN" || body.role === "USER") data.role = body.role
  if (typeof body.active === "boolean") data.active = body.active

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  // L5: prevent locking out the last active ADMIN
  const isDemotingOrDeactivating =
    (data.role !== undefined && data.role !== "ADMIN") || data.active === false
  if (isDemotingOrDeactivating) {
    const target = await prisma.user.findUnique({ where: { id }, select: { role: true, active: true } })
    if (target?.role === "ADMIN" && target.active) {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN", active: true } })
      if (adminCount === 1) {
        return NextResponse.json(
          { error: "Cannot deactivate or demote the last active ADMIN" },
          { status: 422 },
        )
      }
    }
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, username: true, role: true, active: true, createdAt: true },
    })
    return NextResponse.json(user)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    throw e
  }
}

// DELETE /api/users/[id] (ADMIN)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin()
  if (isResponse(auth)) return auth

  const { id } = await params
  try {
    await prisma.user.delete({ where: { id } })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    throw e
  }
  return new NextResponse(null, { status: 204 })
}

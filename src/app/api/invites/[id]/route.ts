import { NextRequest, NextResponse } from "next/server"
import { requireAdmin, isResponse } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"

type Params = { params: Promise<{ id: string }> }

// DELETE /api/invites/[id] — revoke a pending invite (ADMIN).
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin()
  if (isResponse(auth)) return auth

  const { id } = await params
  await prisma.invite.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}

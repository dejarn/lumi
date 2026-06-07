import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin, isResponse } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"

type Params = { params: Promise<{ token: string }> }

// GET /api/invites/[token] — PUBLIC. Validate a token without consuming it so the
// registration form can render. 404 unknown, 410 expired/used.
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex")
  const invite = await prisma.invite.findUnique({ where: { tokenHash } })
  if (!invite) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (invite.usedAt !== null || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invite expired or already used" }, { status: 410 })
  }
  return NextResponse.json({ role: invite.role, expiresAt: invite.expiresAt })
}

// DELETE /api/invites/[token] — revoke a pending invite by id (ADMIN).
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin()
  if (isResponse(auth)) return auth

  const { token: id } = await params
  await prisma.invite.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}

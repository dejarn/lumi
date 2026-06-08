import crypto from "crypto"
import { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin, isResponse } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"

type Params = { params: Promise<{ token: string }> }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

// DELETE /api/invites/[id] — revoke by invite UUID (ADMIN). Same dynamic segment as
// GET (App Router forbids sibling [id] vs [token]); callers pass the invite PK.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin()
  if (isResponse(auth)) return auth

  const { token: id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    await prisma.invite.delete({ where: { id } })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    throw e
  }
  return new NextResponse(null, { status: 204 })
}

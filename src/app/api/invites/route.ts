import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin, isResponse } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"

// GET /api/invites — list pending + used (ADMIN)
export async function GET() {
  const auth = await requireAdmin()
  if (isResponse(auth)) return auth

  const invites = await prisma.invite.findMany({
    select: { id: true, role: true, expiresAt: true, usedAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(invites)
}

// POST /api/invites — create an invite, returns the one-time token (ADMIN).
// Only a hash is stored; the raw token is returned once at creation.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (isResponse(auth)) return auth

  const body = await req.json().catch(() => ({}))
  const role = body.role === "ADMIN" ? "ADMIN" : "USER"

  const rawToken = crypto.randomBytes(32).toString("hex")
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000)

  const invite = await prisma.invite.create({
    data: { tokenHash, role, expiresAt, createdById: auth.id },
  })
  return NextResponse.json(
    { id: invite.id, token: rawToken, role: invite.role, expiresAt: invite.expiresAt, usedAt: null },
    { status: 201 },
  )
}

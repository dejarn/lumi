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
  // TODO: generate a random token, store its hash (sha-256), set expiresAt,
  // return { id, token, role, expiresAt, usedAt: null }.
  void role
  void prisma
  return NextResponse.json({ error: "Not implemented" }, { status: 501 })
}

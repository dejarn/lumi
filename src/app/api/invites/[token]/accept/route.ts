import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

type Params = { params: Promise<{ token: string }> }

// POST /api/invites/[token]/accept — PUBLIC. Consume the invite, create the User
// with the invite's role, mark it used. 409 duplicate username, 410 expired/used,
// 400 weak/missing password.
export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params
  const { username, password } = await req.json().catch(() => ({}))
  if (!username || !password) {
    return NextResponse.json({ error: "username and password required" }, { status: 400 })
  }
  // TODO: validate token (hash lookup, expiry, unused), bcrypt the password,
  // create User in a transaction that also sets invite.usedAt, handle P2002 → 409.
  void token
  void prisma
  return NextResponse.json({ error: "Not implemented" }, { status: 501 })
}

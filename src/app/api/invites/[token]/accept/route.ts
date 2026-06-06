import crypto from "crypto"
import bcrypt from "bcryptjs"
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
  if (typeof username !== "string" || username.trim().length === 0 || username.trim().length > 32) {
    return NextResponse.json({ error: "username must be 1–32 characters" }, { status: 400 })
  }
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 })
  }
  const cleanUsername = username.trim()

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex")
  const invite = await prisma.invite.findUnique({ where: { tokenHash } })
  if (!invite) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (invite.usedAt !== null || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invite expired or already used" }, { status: 410 })
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  try {
    const user = await prisma.$transaction(async (tx) => {
      await tx.invite.update({ where: { id: invite.id }, data: { usedAt: new Date() } })
      return tx.user.create({
        data: { username: cleanUsername, hashedPassword, role: invite.role },
        select: { id: true, username: true, role: true },
      })
    })
    return NextResponse.json(user, { status: 201 })
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 })
    }
    throw err
  }
}

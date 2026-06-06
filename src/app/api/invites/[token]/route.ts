import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

type Params = { params: Promise<{ token: string }> }

// GET /api/invites/[token] — PUBLIC. Validate a token without consuming it so the
// registration form can render. 404 unknown, 410 expired/used.
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params
  // TODO: hash `token`, look up by tokenHash; 404 if none; 410 if usedAt or expired.
  void token
  void prisma
  return NextResponse.json({ error: "Not implemented" }, { status: 501 })
}

import { NextResponse } from "next/server"
import { requireAdmin, isResponse } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"

// GET /api/users — list (ADMIN). hashedPassword never returned.
export async function GET() {
  const auth = await requireAdmin()
  if (isResponse(auth)) return auth

  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true, active: true, createdAt: true },
    orderBy: { username: "asc" },
  })
  return NextResponse.json(users)
}

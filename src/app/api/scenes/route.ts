import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { requireUser, requireAdmin, isResponse } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"

// GET /api/scenes — list (USER)
export async function GET() {
  const auth = await requireUser()
  if (isResponse(auth)) return auth

  const scenes = await prisma.scene.findMany({ orderBy: { name: "asc" } })
  return NextResponse.json(scenes)
}

// POST /api/scenes — create an empty scene (ADMIN). name unique → 409.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (isResponse(auth)) return auth

  const { name } = await req.json()
  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 })
  }
  try {
    const scene = await prisma.scene.create({ data: { name: name.trim() } })
    return NextResponse.json(scene, { status: 201 })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "Scene name already exists" }, { status: 409 })
    }
    throw e
  }
}

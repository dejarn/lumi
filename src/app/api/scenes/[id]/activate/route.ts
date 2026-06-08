import { NextRequest, NextResponse } from "next/server"
import { requireUser, isResponse } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { activateScene } from "@/lib/automation/scheduler"

type Params = { params: Promise<{ id: string }> }

// POST /api/scenes/[id]/activate — fan out all device states at once (USER).
// Best-effort: returns 202; resulting states stream back over SSE.
export async function POST(_req: NextRequest, { params }: Params) {
  const auth = await requireUser()
  if (isResponse(auth)) return auth

  const { id } = await params
  const scene = await prisma.scene.findUnique({ where: { id }, select: { id: true } })
  if (!scene) return NextResponse.json({ error: "Not found" }, { status: 404 })

  void activateScene(id).catch((e) => console.error("activateScene failed", id, e))
  return new NextResponse(null, { status: 202 })
}

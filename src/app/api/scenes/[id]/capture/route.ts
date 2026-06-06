import { NextRequest, NextResponse } from "next/server"
import { requireAdmin, isResponse } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"

type Params = { params: Promise<{ id: string }> }

// POST /api/scenes/[id]/capture — snapshot the CURRENT state of the given lights
// into the scene (ADMIN). Only LIGHT devices; a SENSOR id → 422.
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin()
  if (isResponse(auth)) return auth

  const { id } = await params
  const { deviceIds } = await req.json()
  if (!Array.isArray(deviceIds)) {
    return NextResponse.json({ error: "deviceIds required" }, { status: 400 })
  }

  // TODO: read each device's current light state, upsert SceneDevice rows
  // (replacing existing rows for those devices), reject SENSOR ids with 422.
  void prisma
  void id
  return NextResponse.json({ error: "Not implemented" }, { status: 501 })
}

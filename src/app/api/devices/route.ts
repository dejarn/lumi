import { NextResponse } from "next/server"
import { requireUser, isResponse } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"

// GET /api/devices — list all devices with current state (USER).
export async function GET() {
  const auth = await requireUser()
  if (isResponse(auth)) return auth

  const devices = await prisma.device.findMany({ orderBy: { name: "asc" } })
  return NextResponse.json(devices)
}

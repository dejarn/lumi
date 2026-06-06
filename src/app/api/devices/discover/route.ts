import { NextResponse } from "next/server"
import { requireAdmin, isResponse } from "@/lib/auth-guard"
import { triggerDiscovery } from "@/lib/bridge-client"

// POST /api/devices/discover — broadcast a discovery sweep (ADMIN). New devices
// appear via SSE as the bridge upserts them.
export async function POST() {
  const auth = await requireAdmin()
  if (isResponse(auth)) return auth

  const res = await triggerDiscovery()
  if (!res.ok) return NextResponse.json({ error: "Bridge error" }, { status: 502 })
  return new NextResponse(null, { status: 202 })
}

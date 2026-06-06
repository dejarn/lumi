import { NextResponse } from "next/server"
import { cache } from "react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { Role } from "@prisma/client"

export type AuthedUser = { id: string; username: string; role: Role }

/**
 * Instant revocation (CLAUDE.md rule 3): the JWT is never trusted alone. Every
 * call re-validates the session's userId against the DB and rejects if the user
 * is missing or `active = false`. This is how a departed flatmate is cut off
 * without a server-side session store.
 *
 * Returns the user, or a 401 NextResponse to return directly from a Route Handler.
 */
export const resolveUser = cache(async (): Promise<AuthedUser | NextResponse> => {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, username: true, role: true, active: true },
  })
  if (!user || !user.active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return { id: user.id, username: user.username, role: user.role }
})

/** Guard for USER-or-above routes. Returns the user or a 401 response. */
export async function requireUser(): Promise<AuthedUser | NextResponse> {
  return resolveUser()
}

/** Guard for ADMIN-only routes. Returns the user, or a 401/403 response. */
export async function requireAdmin(): Promise<AuthedUser | NextResponse> {
  const result = await resolveUser()
  if (result instanceof NextResponse) return result
  if (result.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return result
}

/** Narrowing helper: true when the guard returned an error response. */
export function isResponse(v: AuthedUser | NextResponse): v is NextResponse {
  return v instanceof NextResponse
}

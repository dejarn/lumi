import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireUser, isResponse } from "@/lib/auth-guard"

describe("requireUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 JSON when user is inactive (revocation)", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", username: "alice", role: "USER" },
      expires: "2099-01-01",
    } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1",
      username: "alice",
      role: "USER",
      active: false,
    } as never)

    const result = await requireUser()
    expect(isResponse(result)).toBe(true)
    expect((result as NextResponse).status).toBe(401)
    const body = await (result as NextResponse).json()
    expect(body).toEqual({ error: "Unauthorized" })
  })

  it("returns authed user when session and DB active", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", username: "alice", role: "USER" },
      expires: "2099-01-01",
    } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1",
      username: "alice",
      role: "USER",
      active: true,
    } as never)

    const result = await requireUser()
    expect(isResponse(result)).toBe(false)
    expect(result).toEqual({ id: "u1", username: "alice", role: "USER" })
  })

  it("returns 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never)

    const result = await requireUser()
    expect(isResponse(result)).toBe(true)
    expect((result as NextResponse).status).toBe(401)
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

vi.mock("@/lib/auth-guard", () => ({
  requireUser: vi.fn(),
  requireAdmin: vi.fn(),
  isResponse: vi.fn((v: unknown) => v instanceof NextResponse),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trigger: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    device: { findUnique: vi.fn() },
  },
}))

vi.mock("@/lib/automation/scheduler", () => ({
  reloadCronJobs: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("node-cron", () => ({
  default: { validate: vi.fn().mockReturnValue(true) },
}))

import { requireUser, requireAdmin } from "@/lib/auth-guard"
// requireUser used in USER branch; requireAdmin used in ADMIN branch
import { prisma } from "@/lib/prisma"
import { PATCH } from "./route"

const authedUser = { id: "u1", username: "alice", role: "USER" as const }
const authedAdmin = { id: "u2", username: "bob", role: "ADMIN" as const }

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/triggers/t1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

const params = Promise.resolve({ id: "t1" })

describe("PATCH /api/triggers/[id] — USER/ADMIN matrix", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.trigger.findUnique).mockResolvedValue({
      id: "t1",
      type: "CRON",
    } as never)
    vi.mocked(prisma.trigger.update).mockResolvedValue({ id: "t1", enabled: false } as never)
  })

  it("USER + {enabled:false} → 200", async () => {
    vi.mocked(requireUser).mockResolvedValue(authedUser as never)
    const res = await PATCH(makeReq({ enabled: false }), { params })
    expect(res.status).toBe(200)
  })

  it("USER + {enabled:false, name:'x'} → 401/403 (admin branch)", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }) as never,
    )
    const res = await PATCH(makeReq({ enabled: false, name: "x" }), { params })
    expect(res.status).toBe(403)
  })

  it("USER + {name:'x'} only → 401/403 (admin branch)", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }) as never,
    )
    const res = await PATCH(makeReq({ name: "x" }), { params })
    expect(res.status).toBe(403)
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"
import { authorizeCredentials } from "@/lib/credentials"

describe("authorizeCredentials", () => {
  const env = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ADMIN_USERNAME = "admin"
    process.env.ADMIN_PASSWORD = "secretpass"
  })

  afterEach(() => {
    process.env = { ...env }
  })

  it("does not throw on username length mismatch vs env", async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(1)
    const result = await authorizeCredentials("x", "secretpass")
    expect(result).toBeNull()
  })

  it("rejects env bootstrap when an active admin already exists", async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(1)
    const result = await authorizeCredentials("admin", "secretpass")
    expect(result).toBeNull()
    expect(prisma.user.upsert).not.toHaveBeenCalled()
  })

  it("rejects env bootstrap when admin is inactive", async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(0)
    vi.mocked(prisma.user.upsert).mockResolvedValue({
      id: "a1",
      username: "admin",
      role: "ADMIN",
      active: false,
      hashedPassword: "x",
      createdAt: new Date(),
    } as never)

    const result = await authorizeCredentials("admin", "secretpass")
    expect(result).toBeNull()
  })

  it("returns admin on env bootstrap when active", async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(0)
    vi.mocked(prisma.user.upsert).mockResolvedValue({
      id: "a1",
      username: "admin",
      role: "ADMIN",
      active: true,
      hashedPassword: "x",
      createdAt: new Date(),
    } as never)

    const result = await authorizeCredentials("admin", "secretpass")
    expect(result).toEqual({ id: "a1", username: "admin", role: "ADMIN" })
  })
})

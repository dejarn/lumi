import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

vi.mock("@/lib/auth-guard", () => ({
  requireAdmin: vi.fn(),
  isResponse: vi.fn((v: unknown) => v instanceof NextResponse),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    device: { findMany: vi.fn() },
    scene: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { requireAdmin } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { POST } from "./route"

const params = Promise.resolve({ id: "scene-1" })

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/scenes/scene-1/capture", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

describe("POST /api/scenes/[id]/capture", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when requireAdmin fails", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    )

    const res = await POST(makeReq({ deviceIds: [] }), { params })
    expect(res.status).toBe(401)
  })

  it("replaces scene membership with selected devices", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ id: "u1", username: "admin", role: "ADMIN" })
    vi.mocked(prisma.scene.findUnique).mockResolvedValue({ id: "scene-1" } as never)
    vi.mocked(prisma.device.findMany).mockResolvedValue([
      {
        id: "dev-1",
        kind: "LIGHT",
        power: true,
        brightness: 120,
        hue: 5000,
        saturation: 255,
        colorBrightness: 180,
        animId: 0,
      },
    ] as never)

    const deleteMany = vi.fn().mockResolvedValue({ count: 2 })
    const createMany = vi.fn().mockResolvedValue({ count: 1 })
    const findMany = vi.fn().mockResolvedValue([
      {
        sceneId: "scene-1",
        deviceId: "dev-1",
        power: true,
        brightness: 120,
        hue: 5000,
        saturation: 255,
        colorBrightness: 180,
        animId: 0,
      },
    ])
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      fn({ sceneDevice: { deleteMany, createMany, findMany } } as never),
    )

    const res = await POST(makeReq({ deviceIds: ["dev-1"] }), { params })
    expect(res.status).toBe(200)
    expect(deleteMany).toHaveBeenCalledWith({ where: { sceneId: "scene-1" } })
    expect(createMany).toHaveBeenCalledOnce()
    expect(findMany).toHaveBeenCalledWith({
      where: { sceneId: "scene-1" },
      orderBy: { deviceId: "asc" },
    })
  })

  it("clears all devices when deviceIds is empty", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ id: "u1", username: "admin", role: "ADMIN" })
    vi.mocked(prisma.scene.findUnique).mockResolvedValue({ id: "scene-1" } as never)
    vi.mocked(prisma.device.findMany).mockResolvedValue([])

    const deleteMany = vi.fn().mockResolvedValue({ count: 3 })
    const createMany = vi.fn()
    const findMany = vi.fn().mockResolvedValue([])
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      fn({ sceneDevice: { deleteMany, createMany, findMany } } as never),
    )

    const res = await POST(makeReq({ deviceIds: [] }), { params })
    expect(res.status).toBe(200)
    expect(deleteMany).toHaveBeenCalledWith({ where: { sceneId: "scene-1" } })
    expect(createMany).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body).toEqual([])
  })

  it("returns 422 for SENSOR devices", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ id: "u1", username: "admin", role: "ADMIN" })
    vi.mocked(prisma.device.findMany).mockResolvedValue([
      { id: "dev-s", kind: "SENSOR" },
    ] as never)

    const res = await POST(makeReq({ deviceIds: ["dev-s"] }), { params })
    expect(res.status).toBe(422)
  })
})

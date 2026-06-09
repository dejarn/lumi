import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

vi.mock("@/lib/auth-guard", () => ({
  requireUser: vi.fn(),
  requireAdmin: vi.fn(),
  isResponse: vi.fn((v: unknown) => v instanceof NextResponse),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    scene: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { requireUser } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { GET } from "./route"

const params = Promise.resolve({ id: "scene-1" })

describe("GET /api/scenes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when requireUser fails", async () => {
    vi.mocked(requireUser).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    )

    const res = await GET(new NextRequest("http://localhost/api/scenes/scene-1"), { params })
    expect(res.status).toBe(401)
  })

  it("returns 404 when scene not found", async () => {
    vi.mocked(requireUser).mockResolvedValue({ id: "u1", username: "alice", role: "USER" })
    vi.mocked(prisma.scene.findUnique).mockResolvedValue(null)

    const res = await GET(new NextRequest("http://localhost/api/scenes/scene-1"), { params })
    expect(res.status).toBe(404)
  })

  it("returns scene with target and current device state", async () => {
    vi.mocked(requireUser).mockResolvedValue({ id: "u1", username: "alice", role: "USER" })
    vi.mocked(prisma.scene.findUnique).mockResolvedValue({
      id: "scene-1",
      name: "Soirée",
      createdAt: new Date(),
      sceneDevices: [
        {
          sceneId: "scene-1",
          deviceId: "dev-1",
          power: true,
          brightness: 120,
          hue: 5000,
          saturation: 255,
          colorBrightness: 180,
          animId: 0,
          device: {
            id: "dev-1",
            name: "Salon",
            reachable: true,
            kind: "LIGHT",
            power: false,
            brightness: 80,
            hue: 3000,
            saturation: 200,
            colorBrightness: 150,
            animId: 0,
            animSpeed: 128,
            animIntensity: 128,
          },
        },
      ],
    } as never)

    const res = await GET(new NextRequest("http://localhost/api/scenes/scene-1"), { params })
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body).toEqual({
      id: "scene-1",
      name: "Soirée",
      devices: [
        {
          deviceId: "dev-1",
          power: true,
          brightness: 120,
          hue: 5000,
          saturation: 255,
          colorBrightness: 180,
          animId: 0,
          name: "Salon",
          reachable: true,
          kind: "LIGHT",
          current: {
            power: false,
            brightness: 80,
            hue: 3000,
            saturation: 200,
            colorBrightness: 150,
            animId: 0,
            animSpeed: 128,
            animIntensity: 128,
          },
        },
      ],
    })
  })
})

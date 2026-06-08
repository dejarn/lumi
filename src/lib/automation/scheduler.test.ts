import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    sceneDevice: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock("@/lib/bridge-client", () => ({
  sendCommand: vi.fn().mockResolvedValue({ ok: true }),
}))

import { prisma } from "@/lib/prisma"
import { sendCommand } from "@/lib/bridge-client"
import { activateScene } from "@/lib/automation/scheduler"

describe("CRON triggers", () => {
  it.todo("registers one node-cron job per enabled CRON trigger at boot")
  it.todo("re-registers jobs when a trigger is created/edited/enabled/disabled/deleted")
  it.todo("skips silently when the bridge is unreachable (no retry, no catch-up)")
})

describe("SENSOR triggers", () => {
  it.todo("fires when sensorActive equals the trigger's sensorState")
  it.todo("ignores disabled triggers")
  it.todo("fires on every matching event in v1 (no debounce)")
})

describe("scene fan-out", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("emits power, master brightness, then color with colorBrightness when animId is 0", async () => {
    vi.mocked(prisma.sceneDevice.findMany).mockResolvedValue([
      {
        sceneId: "s1",
        deviceId: "d1",
        power: true,
        brightness: 80,
        hue: 120,
        saturation: 200,
        colorBrightness: 40,
        animId: 0,
      },
    ] as never)

    await activateScene("s1")

    expect(sendCommand).toHaveBeenCalledTimes(3)
    expect(sendCommand).toHaveBeenNthCalledWith(1, "d1", { type: "power", on: true })
    expect(sendCommand).toHaveBeenNthCalledWith(2, "d1", { type: "brightness", brightness: 80 })
    expect(sendCommand).toHaveBeenNthCalledWith(3, "d1", {
      type: "color",
      hue: 120,
      saturation: 200,
      brightness: 40,
    })
  })

  it("uses colorBrightness not master brightness in color command", async () => {
    vi.mocked(prisma.sceneDevice.findMany).mockResolvedValue([
      {
        sceneId: "s1",
        deviceId: "d1",
        power: true,
        brightness: 200,
        hue: 0,
        saturation: 255,
        colorBrightness: 50,
        animId: 0,
      },
    ] as never)

    await activateScene("s1")

    const colorCall = vi.mocked(sendCommand).mock.calls.find(
      ([, cmd]) => cmd.type === "color",
    )
    expect(colorCall?.[1]).toMatchObject({ brightness: 50 })
    expect(colorCall?.[1]).not.toMatchObject({ brightness: 200 })
  })

  it("emits power, brightness, stopAnimation, animation when animId is non-zero", async () => {
    vi.mocked(prisma.sceneDevice.findMany).mockResolvedValue([
      {
        sceneId: "s1",
        deviceId: "d1",
        power: true,
        brightness: 100,
        hue: 0,
        saturation: 0,
        colorBrightness: 0,
        animId: 3,
      },
    ] as never)

    await activateScene("s1")

    expect(sendCommand).toHaveBeenCalledTimes(4)
    expect(sendCommand).toHaveBeenNthCalledWith(1, "d1", { type: "power", on: true })
    expect(sendCommand).toHaveBeenNthCalledWith(2, "d1", { type: "brightness", brightness: 100 })
    expect(sendCommand).toHaveBeenNthCalledWith(3, "d1", { type: "stopAnimation" })
    expect(sendCommand).toHaveBeenNthCalledWith(4, "d1", {
      type: "animation",
      animId: 3,
      speed: 128,
      intensity: 200,
    })
  })

  it("tolerates partial failure without throwing", async () => {
    vi.mocked(prisma.sceneDevice.findMany).mockResolvedValue([
      {
        sceneId: "s1",
        deviceId: "d1",
        power: true,
        brightness: 80,
        hue: 0,
        saturation: 0,
        colorBrightness: 40,
        animId: 0,
      },
      {
        sceneId: "s1",
        deviceId: "d2",
        power: true,
        brightness: 80,
        hue: 0,
        saturation: 0,
        colorBrightness: 40,
        animId: 0,
      },
    ] as never)

    vi.mocked(sendCommand).mockImplementation(async (_id, cmd) => {
      if (cmd.type === "power" && _id === "d1") {
        throw new Error("bridge down")
      }
      return { ok: true } as Response
    })

    await expect(activateScene("s1")).resolves.toBeUndefined()
    expect(sendCommand).toHaveBeenCalled()
  })
})

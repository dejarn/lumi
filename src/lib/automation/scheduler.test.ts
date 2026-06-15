import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    sceneDevice: { findMany: vi.fn() },
    trigger: { findMany: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    device: { findUnique: vi.fn() },
  },
}))

vi.mock("@/lib/bridge-client", () => ({
  sendCommand: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
}))

vi.mock("node-cron", () => ({
  default: {
    validate: vi.fn().mockReturnValue(true),
    schedule: vi.fn().mockReturnValue({ stop: vi.fn() }),
  },
}))

import cron from "node-cron"
import { prisma } from "@/lib/prisma"
import { sendCommand } from "@/lib/bridge-client"
import { activateScene, reloadCronJobs, onSensorEvent } from "@/lib/automation/scheduler"

describe("CRON triggers", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("registers one node-cron job per enabled CRON trigger", async () => {
    vi.mocked(prisma.trigger.findMany).mockResolvedValue([
      { id: "t1", cronExpr: "* * * * *", sceneId: "s1" },
      { id: "t2", cronExpr: "0 7 * * *", sceneId: "s2" },
    ] as never)
    await reloadCronJobs()
    expect(cron.schedule).toHaveBeenCalledTimes(2)
  })

  it("skips trigger with invalid cronExpr", async () => {
    vi.mocked(cron.validate).mockReturnValueOnce(false)
    vi.mocked(prisma.trigger.findMany).mockResolvedValue([
      { id: "t1", cronExpr: "bad", sceneId: "s1" },
    ] as never)
    await reloadCronJobs()
    expect(cron.schedule).not.toHaveBeenCalled()
  })

  it.todo("re-registers jobs when a trigger is created/edited/enabled/disabled/deleted")
  it.todo("skips silently when the bridge is unreachable (no retry, no catch-up)")
})

describe("SENSOR triggers", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fires when sensorActive equals the trigger's sensorState", async () => {
    vi.mocked(prisma.device.findUnique).mockResolvedValue({ kind: "SENSOR", sensorActive: true } as never)
    vi.mocked(prisma.trigger.findMany).mockResolvedValue([
      { id: "t1", sceneId: "s1" },
    ] as never)
    vi.mocked(prisma.sceneDevice.findMany).mockResolvedValue([])
    await onSensorEvent("d1")
    expect(prisma.trigger.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "t1" } }))
  })

  it("ignores non-SENSOR devices", async () => {
    vi.mocked(prisma.device.findUnique).mockResolvedValue({ kind: "LIGHT", sensorActive: null } as never)
    await onSensorEvent("d1")
    expect(prisma.trigger.findMany).not.toHaveBeenCalled()
  })

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
        animSpeed: 64,
        animIntensity: 180,
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
      speed: 64,
      intensity: 180,
    })
  })

  it("stops sending commands to a device on bridge 502 (M9 fail-fast)", async () => {
    vi.mocked(prisma.sceneDevice.findMany).mockResolvedValue([
      {
        sceneId: "s1", deviceId: "d1", power: true, brightness: 80,
        hue: 0, saturation: 0, colorBrightness: 40, animId: 0,
        animSpeed: 128, animIntensity: 200,
      },
    ] as never)
    vi.mocked(sendCommand).mockResolvedValue({ ok: false, status: 502 } as never)
    await activateScene("s1")
    // Only first command sent; loop breaks on 502
    expect(sendCommand).toHaveBeenCalledTimes(1)
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

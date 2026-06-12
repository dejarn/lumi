import { describe, expect, it, vi } from "vitest"

// hue.ts imports state.js (Prisma client) — stub it out for unit tests.
vi.mock("./state.js", () => ({
  upsertHueLight: vi.fn(),
}))

const { buildLightUpdateBody, commandToHue, parseLightResource } = await import("./hue.js")

describe("commandToHue", () => {
  it("maps power", () => {
    expect(commandToHue({ type: "setPower", on: true })).toEqual({ power: true })
  })

  it("maps brightness", () => {
    expect(commandToHue({ type: "setBrightness", brightness: 128 })).toEqual({ brightness: 128 })
  })

  it("maps color", () => {
    expect(commandToHue({ type: "setColor", hue: 32768, saturation: 255, brightness: 200 })).toEqual({
      hue: 32768,
      saturation: 255,
      brightness: 200,
    })
  })

  it("rejects animations", () => {
    expect(commandToHue({ type: "setAnimation", animId: 1, speed: 10, intensity: 10 })).toBeNull()
    expect(commandToHue({ type: "stopAnimation" })).toBeNull()
  })
})

describe("buildLightUpdateBody", () => {
  it("power only", () => {
    expect(buildLightUpdateBody({ power: false })).toEqual({ on: { on: false } })
  })

  it("brightness only → dimming percent", () => {
    expect(buildLightUpdateBody({ brightness: 255 })).toEqual({ dimming: { brightness: 100 } })
  })

  it("full color → dimming + xy", () => {
    const body = buildLightUpdateBody({ hue: 0, saturation: 255, brightness: 255 }) as {
      dimming: { brightness: number }
      color: { xy: { x: number; y: number } }
    }
    expect(body.dimming.brightness).toBe(100)
    // Saturated red lands in the red corner of the gamut.
    expect(body.color.xy.x).toBeGreaterThan(0.6)
    expect(body.color.xy.y).toBeLessThan(0.4)
  })

  it("color requires both hue and saturation", () => {
    expect(buildLightUpdateBody({ hue: 100 })).toEqual({})
  })
})

describe("parseLightResource", () => {
  it("maps full light resource to upsert input", () => {
    const input = parseLightResource(
      {
        id: "uuid-1",
        owner: { rid: "dev-1" },
        metadata: { name: "Salon" },
        on: { on: true },
        dimming: { brightness: 50 },
        color: { xy: { x: 0.675, y: 0.322 } }, // red corner
      },
      true,
    )
    expect(input.externalId).toBe("uuid-1")
    expect(input.name).toBe("Salon")
    expect(input.reachable).toBe(true)
    expect(input.power).toBe(true)
    expect(input.brightness).toBe(128)
    expect(input.saturation).toBeGreaterThan(200)
    // Red → hue near 0 (or wrapped near 65535).
    const hue = input.hue ?? 0
    expect(Math.min(hue, 65536 - hue)).toBeLessThan(4000)
  })

  it("omits state fields absent from the resource", () => {
    const input = parseLightResource({ id: "uuid-2" }, false)
    expect(input).toEqual({ externalId: "uuid-2", name: "uuid-2", reachable: false })
  })
})

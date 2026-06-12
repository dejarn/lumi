import { describe, expect, it } from "vitest"
import { byteToPercent, hsvToXy, percentToByte, xyToHsv } from "./hue-color.js"

// Gamut clamping makes the round-trip lossy — assert within tolerance.
const HUE_TOLERANCE = 3000 // ~16° of 360°
const SAT_TOLERANCE = 40

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 65536
  return Math.min(d, 65536 - d)
}

describe("hsvToXy / xyToHsv round-trip", () => {
  it.each([
    ["red", 0, 255],
    ["green", 21845, 255],
    ["blue", 43690, 255],
    ["yellow", 10922, 255],
    ["half-saturated cyan", 32768, 128],
  ])("%s", (_label, hue, saturation) => {
    const xy = hsvToXy(hue, saturation)
    expect(xy.x).toBeGreaterThan(0)
    expect(xy.x).toBeLessThan(1)
    expect(xy.y).toBeGreaterThan(0)
    expect(xy.y).toBeLessThan(1)

    const back = xyToHsv(xy.x, xy.y)
    expect(hueDistance(back.hue, hue)).toBeLessThanOrEqual(HUE_TOLERANCE)
    expect(Math.abs(back.saturation - saturation)).toBeLessThanOrEqual(SAT_TOLERANCE)
  })

  it("white (saturation 0) maps near D65 and back to low saturation", () => {
    const xy = hsvToXy(0, 0)
    expect(xy.x).toBeCloseTo(0.3127, 1)
    expect(xy.y).toBeCloseTo(0.329, 1)

    const back = xyToHsv(xy.x, xy.y)
    expect(back.saturation).toBeLessThanOrEqual(SAT_TOLERANCE)
  })

  it("handles degenerate xy without NaN", () => {
    expect(xyToHsv(0, 0)).toEqual({ hue: 0, saturation: 0 })
    const out = xyToHsv(0.9, 0.05) // far out of gamut
    expect(Number.isFinite(out.hue)).toBe(true)
    expect(out.saturation).toBeGreaterThanOrEqual(0)
    expect(out.saturation).toBeLessThanOrEqual(255)
  })
})

describe("brightness conversions", () => {
  it("byte → percent", () => {
    expect(byteToPercent(0)).toBe(0)
    expect(byteToPercent(255)).toBe(100)
    expect(byteToPercent(128)).toBeCloseTo(50.2, 1)
  })

  it("percent → byte", () => {
    expect(percentToByte(0)).toBe(0)
    expect(percentToByte(100)).toBe(255)
    expect(percentToByte(50)).toBe(128)
  })

  it("clamps out-of-range input", () => {
    expect(byteToPercent(300)).toBe(100)
    expect(percentToByte(120)).toBe(255)
    expect(percentToByte(-5)).toBe(0)
  })
})

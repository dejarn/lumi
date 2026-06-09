import { describe, it, expect } from "vitest"
import { apiToPicker, pickerToApi, averageColor, tileTint } from "@/lib/color"

describe("color conversions", () => {
  it("round-trips picker ↔ API HSV", () => {
    const api = { hue: 32768, saturation: 128, colorBrightness: 200 }
    const picker = apiToPicker(api)
    const back = pickerToApi(picker)
    expect(back.hue).toBe(api.hue)
    expect(back.saturation).toBe(api.saturation)
    expect(back.colorBrightness).toBe(api.colorBrightness)
  })
})

describe("averageColor", () => {
  it("returns transparent for an empty list", () => {
    expect(averageColor([])).toBe("transparent")
  })

  it("treats powered-off devices as black in the average", () => {
    const warmOn = { power: true, hue: 0, saturation: 255, colorBrightness: 255 }
    const off = { power: false, hue: 0, saturation: 255, colorBrightness: 255 }
    const onlyOff = averageColor([off])
    expect(onlyOff).toBe("#000000")

    const mixed = averageColor([warmOn, off])
    const [r, g, b] = mixed
      .slice(1)
      .match(/.{2}/g)!
      .map((h) => parseInt(h, 16))
    expect(r).toBeGreaterThan(g)
    expect(r).toBeLessThan(255)
  })
})

describe("tileTint", () => {
  it("makes red hue dominant in R for apiHue ≈ 0", () => {
    const rgba = tileTint(0)
    const match = rgba.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),/)
    expect(match).not.toBeNull()
    const r = Number(match![1])
    const g = Number(match![2])
    const b = Number(match![3])
    expect(r).toBeGreaterThan(g)
    expect(r).toBeGreaterThan(b)
  })

  it("respects custom alpha", () => {
    expect(tileTint(0, 0.3)).toMatch(/0\.3\)$/)
  })

  it("keeps intermediate hues saturated (not gray)", () => {
    const rgba = tileTint(21845) // ~120° — green, G dominant
    const match = rgba.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),/)
    expect(match).not.toBeNull()
    const r = Number(match![1])
    const g = Number(match![2])
    const b = Number(match![3])
    expect(r === g && g === b).toBe(false)
  })
})

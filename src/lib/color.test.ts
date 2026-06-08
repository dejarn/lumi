import { describe, it, expect } from "vitest"
import { apiToPicker, pickerToApi, glowForHue } from "@/lib/color"

describe("color conversions", () => {
  it("round-trips picker ↔ API HSV", () => {
    const api = { hue: 32768, saturation: 128, colorBrightness: 200 }
    const picker = apiToPicker(api)
    const back = pickerToApi(picker)
    expect(back.hue).toBe(api.hue)
    expect(back.saturation).toBe(api.saturation)
    expect(back.colorBrightness).toBe(api.colorBrightness)
  })

  it("classifies cool vs warm glow from hue", () => {
    expect(glowForHue(40000)).toBe("blue")
    expect(glowForHue(0)).toBe("warm")
  })
})

import { describe, it, expect } from "vitest"
import {
  COLOR_TAB,
  ANIMATION_TAB,
  tabForAnimId,
  colorModeCommands,
} from "@/lib/device-control"

describe("tabForAnimId", () => {
  it("returns COLOR_TAB when animId is 0", () => {
    expect(tabForAnimId(0)).toBe(COLOR_TAB)
  })

  it("returns ANIMATION_TAB when animId is 1", () => {
    expect(tabForAnimId(1)).toBe(ANIMATION_TAB)
  })

  it("returns ANIMATION_TAB when animId is 5", () => {
    expect(tabForAnimId(5)).toBe(ANIMATION_TAB)
  })
})

describe("colorModeCommands", () => {
  const colorAction = {
    type: "color" as const,
    hue: 180,
    saturation: 100,
    brightness: 200,
  }

  const brightnessAction = {
    type: "brightness" as const,
    brightness: 128,
  }

  it("returns only the color action when animId is 0", () => {
    const commands = colorModeCommands(0, colorAction)
    expect(commands).toHaveLength(1)
    expect(commands[0]).toBe(colorAction)
    expect(commands[0]).toEqual(colorAction)
  })

  it("returns stopAnimation then color action when animId is 3", () => {
    const commands = colorModeCommands(3, colorAction)
    expect(commands).toHaveLength(2)
    expect(commands[0]).toEqual({ type: "stopAnimation" })
    expect(commands[1]).toBe(colorAction)
  })

  it("returns only the brightness action when animId is 0", () => {
    const commands = colorModeCommands(0, brightnessAction)
    expect(commands).toHaveLength(1)
    expect(commands[0]).toBe(brightnessAction)
    expect(commands[0]).toEqual(brightnessAction)
  })

  it("returns stopAnimation then brightness action when animId is 3", () => {
    const commands = colorModeCommands(3, brightnessAction)
    expect(commands).toHaveLength(2)
    expect(commands[0]).toEqual({ type: "stopAnimation" })
    expect(commands[1]).toBe(brightnessAction)
  })
})

import type { DeviceCommand } from "@/lib/types"

export const COLOR_TAB = 0
export const ANIMATION_TAB = 1

export function tabForAnimId(animId: number): number {
  return animId > 0 ? ANIMATION_TAB : COLOR_TAB
}

export function colorModeCommands(
  animId: number,
  action: Extract<DeviceCommand, { type: "color" | "brightness" }>,
): DeviceCommand[] {
  if (animId > 0) {
    return [{ type: "stopAnimation" }, action]
  }
  return [action]
}

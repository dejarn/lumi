import { LUMI_EFFECTS } from "@/lib/animations"

export function effectLabel(animId: number): string {
  return LUMI_EFFECTS.find((e) => e.animId === animId)?.label ?? `#${animId}`
}

type LightState = {
  reachable: boolean
  power?: boolean | null
  brightness?: number | null
  animId?: number | null
}

export function lightStateLabel(state: LightState): string {
  if (!state.reachable) return "Hors ligne"
  const power = state.power ?? false
  const brightness = state.brightness ?? 0
  const animId = state.animId ?? 0
  const animating = power && animId > 0
  const brightnessPct = Math.round((brightness / 255) * 100)
  if (animating) return `Animation · ${effectLabel(animId)}`
  if (power) return `ON · ${brightnessPct}%`
  return "Éteint"
}

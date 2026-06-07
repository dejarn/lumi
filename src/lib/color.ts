export type ApiHsv = { hue: number; saturation: number; colorBrightness: number }

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function apiToPicker(c: ApiHsv): { h: number; s: number; v: number } {
  return {
    h: clamp((c.hue / 65535) * 360, 0, 360),
    s: clamp((c.saturation / 255) * 100, 0, 100),
    v: clamp((c.colorBrightness / 255) * 100, 0, 100),
  }
}

export function pickerToApi(c: { h: number; s: number; v: number }): ApiHsv {
  const h = clamp(c.h, 0, 360)
  const s = clamp(c.s, 0, 100)
  const v = clamp(c.v, 0, 100)

  return {
    hue: clamp(Math.round((h / 360) * 65535), 0, 65535),
    saturation: clamp(Math.round((s / 100) * 255), 0, 255),
    colorBrightness: clamp(Math.round((v / 100) * 255), 0, 255),
  }
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const hh = ((h % 360) + 360) % 360
  const c = v * s
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1))
  const m = v - c

  let r1 = 0
  let g1 = 0
  let b1 = 0

  if (hh < 60) {
    r1 = c
    g1 = x
  } else if (hh < 120) {
    r1 = x
    g1 = c
  } else if (hh < 180) {
    g1 = c
    b1 = x
  } else if (hh < 240) {
    g1 = x
    b1 = c
  } else if (hh < 300) {
    r1 = x
    b1 = c
  } else {
    r1 = c
    b1 = x
  }

  return [
    clamp(Math.round((r1 + m) * 255), 0, 255),
    clamp(Math.round((g1 + m) * 255), 0, 255),
    clamp(Math.round((b1 + m) * 255), 0, 255),
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`
}

/**
 * Warm vs cool glow for a lit bulb, from its API hue (0–65535).
 * Cool (blue) for the blue/cyan/violet arc (~150°–290°), warm otherwise.
 * Used to drive the luminous tile border (docs/design.md: border = state).
 */
export function glowForHue(apiHue: number): "warm" | "blue" {
  const deg = ((apiHue / 65535) * 360 + 360) % 360
  return deg >= 150 && deg <= 290 ? "blue" : "warm"
}

export function apiHsvToHex(c: ApiHsv): string {
  const picker = apiToPicker(c)
  const [r, g, b] = hsvToRgb(picker.h, picker.s / 100, picker.v / 100)
  return rgbToHex(r, g, b)
}

/** Circular mean on hue (degrees) to avoid wrap at 360°. */
function averageHueDegrees(hues: number[]): number {
  let sumSin = 0
  let sumCos = 0

  for (const h of hues) {
    const rad = (h * Math.PI) / 180
    sumSin += Math.sin(rad)
    sumCos += Math.cos(rad)
  }

  let avg = (Math.atan2(sumSin / hues.length, sumCos / hues.length) * 180) / Math.PI
  if (avg < 0) {
    avg += 360
  }

  return avg
}

export function averageColor(devices: ApiHsv[]): string {
  if (devices.length === 0) {
    return "transparent"
  }

  const pickers = devices.map(apiToPicker)
  const avgPicker = {
    h: averageHueDegrees(pickers.map((p) => p.h)),
    s: pickers.reduce((sum, p) => sum + p.s, 0) / pickers.length,
    v: pickers.reduce((sum, p) => sum + p.v, 0) / pickers.length,
  }

  return apiHsvToHex(pickerToApi(avgPicker))
}

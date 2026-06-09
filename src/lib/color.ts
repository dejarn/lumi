export type ApiHsv = { hue: number; saturation: number; colorBrightness: number }

export type SceneColorInput = ApiHsv & { power?: boolean }

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

/** Readable border tint from API hue alone (sat/value clamped for dark UI). */
export function tileTint(apiHue: number, alpha = 0.55): string {
  const deg = ((apiHue / 65535) * 360 + 360) % 360
  const [r, g, b] = hsvToRgb(deg, 0.6, 0.95)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function apiHsvToHex(c: ApiHsv): string {
  const picker = apiToPicker(c)
  const [r, g, b] = hsvToRgb(picker.h, picker.s / 100, picker.v / 100)
  return rgbToHex(r, g, b)
}

/** Scene ambient / card pastille — RGB mean; powered-off devices count as black. */
export function averageColor(devices: SceneColorInput[]): string {
  if (devices.length === 0) {
    return "transparent"
  }

  let sumR = 0
  let sumG = 0
  let sumB = 0

  for (const d of devices) {
    if (d.power === false) continue
    const picker = apiToPicker(d)
    const [r, g, b] = hsvToRgb(picker.h, picker.s / 100, picker.v / 100)
    sumR += r
    sumG += g
    sumB += b
  }

  const n = devices.length
  return rgbToHex(Math.round(sumR / n), Math.round(sumG / n), Math.round(sumB / n))
}

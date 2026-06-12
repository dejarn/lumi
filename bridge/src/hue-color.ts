// Colour conversions between the lumi-protocol HSV model (hue 0–65535,
// saturation/brightness 0–255) and the Hue CLIP v2 API (CIE xy + dimming 0–100).
// Matrices are the Philips wide-gamut RGB↔XYZ pair from the official Hue docs.

export interface Xy {
  x: number
  y: number
}

export interface Hsv {
  hue: number // 0–65535
  saturation: number // 0–255
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** sRGB companding → linear RGB. */
function toLinear(c: number): number {
  return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92
}

/** Linear RGB → sRGB companding. */
function toGamma(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

/** HSV (s in 0–1, v fixed at 1) → RGB in 0–1. */
function hsvToRgb(hDeg: number, s: number): [number, number, number] {
  const c = s
  const x = c * (1 - Math.abs(((hDeg / 60) % 2) - 1))
  const m = 1 - c
  let rgb: [number, number, number]
  if (hDeg < 60) rgb = [c, x, 0]
  else if (hDeg < 120) rgb = [x, c, 0]
  else if (hDeg < 180) rgb = [0, c, x]
  else if (hDeg < 240) rgb = [0, x, c]
  else if (hDeg < 300) rgb = [x, 0, c]
  else rgb = [c, 0, x]
  return [rgb[0] + m, rgb[1] + m, rgb[2] + m]
}

function rgbToHsv(r: number, g: number, b: number): { hDeg: number; s: number } {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let hDeg = 0
  if (d > 0) {
    if (max === r) hDeg = 60 * (((g - b) / d) % 6)
    else if (max === g) hDeg = 60 * ((b - r) / d + 2)
    else hDeg = 60 * ((r - g) / d + 4)
  }
  if (hDeg < 0) hDeg += 360
  const s = max === 0 ? 0 : d / max
  return { hDeg, s }
}

/** lumi-protocol hue/saturation → CIE xy for the Hue API. */
export function hsvToXy(hue: number, saturation: number): Xy {
  const hDeg = (hue / 65536) * 360
  const s = saturation / 255
  const [r, g, b] = hsvToRgb(hDeg, s).map(toLinear) as [number, number, number]

  const X = r * 0.664511 + g * 0.154324 + b * 0.162028
  const Y = r * 0.283881 + g * 0.668433 + b * 0.047685
  const Z = r * 0.000088 + g * 0.07231 + b * 0.986039

  const sum = X + Y + Z
  if (sum === 0) return { x: 0.3127, y: 0.329 } // black → D65 white point
  return { x: X / sum, y: Y / sum }
}

/** CIE xy from the Hue API → lumi-protocol hue/saturation. */
export function xyToHsv(x: number, y: number): Hsv {
  if (y === 0) return { hue: 0, saturation: 0 }
  // Y is set to 1 — brightness is carried by dimming, not xy.
  const X = x / y
  const Y = 1
  const Z = (1 - x - y) / y

  let r = X * 1.656492 - Y * 0.354851 - Z * 0.255038
  let g = -X * 0.707196 + Y * 1.655397 + Z * 0.036152
  let b = X * 0.051713 - Y * 0.121364 + Z * 1.01153

  // Out-of-gamut xy can overshoot — normalize before companding.
  const maxLinear = Math.max(r, g, b)
  if (maxLinear > 1) {
    r /= maxLinear
    g /= maxLinear
    b /= maxLinear
  }

  r = clamp01(toGamma(clamp01(r)))
  g = clamp01(toGamma(clamp01(g)))
  b = clamp01(toGamma(clamp01(b)))

  const { hDeg, s } = rgbToHsv(r, g, b)
  return {
    hue: Math.round((hDeg / 360) * 65535),
    saturation: Math.round(s * 255),
  }
}

/** lumi-protocol byte (0–255) → Hue dimming percent (0–100). */
export function byteToPercent(n: number): number {
  return Math.round((clamp01(n / 255) * 1000)) / 10
}

/** Hue dimming percent (0–100) → lumi-protocol byte (0–255). */
export function percentToByte(p: number): number {
  return Math.round(clamp01(p / 100) * 255)
}

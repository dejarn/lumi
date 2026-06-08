// Shared API/UI types mirroring docs/api.md. Kept lean — Prisma owns persistence types.

export type DeviceCommand =
  | { type: "power"; on: boolean }
  | { type: "brightness"; brightness: number }
  | { type: "color"; hue: number; saturation: number; brightness: number }
  | { type: "animation"; animId: number; speed: number; intensity: number }
  | { type: "stopAnimation" }

// SSE payload pushed on `event: device-state` (docs/api.md#stream-sse).
export type DeviceStatePatch = {
  deviceId: string
  reachable: boolean
  // light fields (kind = LIGHT)
  power?: boolean
  brightness?: number
  hue?: number
  saturation?: number
  colorBrightness?: number
  animId?: number
  animSpeed?: number
  animIntensity?: number
  // sensor field (kind = SENSOR)
  sensorActive?: boolean
}

export type CommandBody =
  | { type: "setPower"; on: boolean }
  | { type: "setBrightness"; brightness: number }
  | { type: "setColor"; hue: number; saturation: number; brightness: number }
  | { type: "setAnimation"; animId: number; speed: number; intensity: number }
  | { type: "stopAnimation" }

function isByte(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 255
}

function isHue(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 65535
}

/** Parse bridge command body (setX names; fake also accepts short aliases). */
export function parseCommand(body: unknown): CommandBody | null {
  if (!body || typeof body !== "object" || !("type" in body)) return null
  const { type } = body as { type: string }

  switch (type) {
    case "power":
    case "setPower": {
      const { on } = body as { on?: unknown }
      if (typeof on !== "boolean") return null
      return { type: "setPower", on }
    }
    case "brightness":
    case "setBrightness": {
      const { brightness } = body as { brightness?: unknown }
      if (!isByte(brightness)) return null
      return { type: "setBrightness", brightness }
    }
    case "color":
    case "setColor": {
      const { hue, saturation, brightness } = body as {
        hue?: unknown
        saturation?: unknown
        brightness?: unknown
      }
      if (!isHue(hue) || !isByte(saturation) || !isByte(brightness)) return null
      return { type: "setColor", hue, saturation, brightness }
    }
    case "animation":
    case "setAnimation": {
      const { animId, speed, intensity } = body as {
        animId?: unknown
        speed?: unknown
        intensity?: unknown
      }
      if (
        typeof animId !== "number" ||
        !Number.isInteger(animId) ||
        typeof speed !== "number" ||
        !Number.isInteger(speed) ||
        typeof intensity !== "number" ||
        !Number.isInteger(intensity)
      ) {
        return null
      }
      return { type: "setAnimation", animId, speed, intensity }
    }
    case "stopAnimation":
      return { type: "stopAnimation" }
    default:
      return null
  }
}

import type { DeviceCommand } from "@/lib/types"

// Bridge HTTP API uses setX command types; the app/API layer uses shorter names (docs/api.md).
type BridgeCommand =
  | { type: "setPower"; on: boolean }
  | { type: "setBrightness"; brightness: number }
  | { type: "setColor"; hue: number; saturation: number; brightness: number }
  | { type: "setAnimation"; animId: number; speed: number; intensity: number }
  | { type: "stopAnimation" }

function toBridgeCommand(command: DeviceCommand): BridgeCommand {
  switch (command.type) {
    case "power":
      return { type: "setPower", on: command.on }
    case "brightness":
      return { type: "setBrightness", brightness: command.brightness }
    case "color":
      return {
        type: "setColor",
        hue: command.hue,
        saturation: command.saturation,
        brightness: command.brightness,
      }
    case "animation":
      return {
        type: "setAnimation",
        animId: command.animId,
        speed: command.speed,
        intensity: command.intensity,
      }
    case "stopAnimation":
      return { type: "stopAnimation" }
  }
}

// Typed client for the internal mqtt-bridge HTTP API (docs/bridge.md). Guarded by
// the shared BRIDGE_TOKEN header; reachable only on the Docker `internal` network.
// Next.js never talks to devices directly — it forwards here (CLAUDE.md rule 1/5).

const BRIDGE_URL = process.env.BRIDGE_URL ?? "http://localhost:4000"
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN ?? ""

const isNextBuild = process.env.NEXT_PHASE === "phase-production-build"
if (process.env.NODE_ENV === "production" && !isNextBuild) {
  if (!BRIDGE_TOKEN) throw new Error("BRIDGE_TOKEN must be set in production")
}

async function call(path: string, body?: unknown): Promise<Response> {
  const timeoutMs = Number(process.env.BRIDGE_TIMEOUT_MS ?? 8000)
  try {
    return await fetch(`${BRIDGE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bridge-token": BRIDGE_TOKEN,
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch {
    return new Response(JSON.stringify({ error: "Bridge timeout" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    })
  }
}

/** Forward a per-device command. Best-effort: resolves once the bridge accepts. */
export async function sendCommand(deviceId: string, command: DeviceCommand): Promise<Response> {
  return call(`/command/${deviceId}`, toBridgeCommand(command))
}

/** LUMI only — persist the device zone (SET_ZONE). */
export async function setZone(deviceId: string, zone: number): Promise<Response> {
  return call(`/zone/${deviceId}`, { zone })
}

/** Broadcast a discovery sweep (DISCOVERY_REQUEST). */
export async function triggerDiscovery(): Promise<Response> {
  return call(`/discover`)
}

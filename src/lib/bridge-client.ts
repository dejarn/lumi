import type { DeviceCommand } from "@/lib/types"

// Typed client for the internal mqtt-bridge HTTP API (docs/bridge.md). Guarded by
// the shared BRIDGE_TOKEN header; reachable only on the Docker `internal` network.
// Next.js never talks to devices directly — it forwards here (CLAUDE.md rule 1/5).

const BRIDGE_URL = process.env.BRIDGE_URL ?? "http://localhost:4000"
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN ?? ""

async function call(path: string, body?: unknown): Promise<Response> {
  return fetch(`${BRIDGE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bridge-token": BRIDGE_TOKEN,
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  })
}

/** Forward a per-device command. Best-effort: resolves once the bridge accepts. */
export async function sendCommand(deviceId: string, command: DeviceCommand): Promise<Response> {
  return call(`/command/${deviceId}`, command)
}

/** LUMI only — persist the device zone (SET_ZONE). */
export async function setZone(deviceId: string, zone: number): Promise<Response> {
  return call(`/zone/${deviceId}`, { zone })
}

/** Broadcast a discovery sweep (DISCOVERY_REQUEST). */
export async function triggerDiscovery(): Promise<Response> {
  return call(`/discover`)
}

import { Agent } from "undici"
import { byteToPercent, hsvToXy, percentToByte, xyToHsv } from "./hue-color.js"
import { upsertHueLight, type HueLightUpsert } from "./state.js"
import type { CommandBody } from "./command.js"

// Hue CLIP v2 (local REST):
// - GET  https://{bridgeIp}/clip/v2/resource/light                — state + discovery
// - GET  https://{bridgeIp}/clip/v2/resource/zigbee_connectivity  — reachability
// - PUT  https://{bridgeIp}/clip/v2/resource/light/{hueId}        — setLight
// - Header: hue-application-key — TLS is self-signed, verification disabled.

export class HueApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "HueApiError"
  }
}

export interface HueLightCommand {
  power?: boolean
  brightness?: number // 0–255
  hue?: number // 0–65535
  saturation?: number // 0–255
}

export interface HueClient {
  setLight(hueId: string, cmd: HueLightCommand): Promise<void>
  /** Fetch lights + connectivity from the Hue Bridge and upsert into Postgres. Returns light count. */
  syncDevices(): Promise<number>
  startPoll(intervalMs: number): void
  stopPoll(): void
}

/** Bridge CommandBody → Hue command. Null = unsupported on HUE (animations). */
export function commandToHue(body: CommandBody): HueLightCommand | null {
  switch (body.type) {
    case "setPower":
      return { power: body.on }
    case "setBrightness":
      return { brightness: body.brightness }
    case "setColor":
      return { hue: body.hue, saturation: body.saturation, brightness: body.brightness }
    case "setAnimation":
    case "stopAnimation":
      return null
  }
}

/** HueLightCommand → CLIP v2 PUT body. */
export function buildLightUpdateBody(cmd: HueLightCommand): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if (cmd.power !== undefined) body.on = { on: cmd.power }
  if (cmd.brightness !== undefined) body.dimming = { brightness: byteToPercent(cmd.brightness) }
  if (cmd.hue !== undefined && cmd.saturation !== undefined) {
    body.color = { xy: hsvToXy(cmd.hue, cmd.saturation) }
  }
  return body
}

interface HueLightResource {
  id: string
  owner?: { rid: string }
  metadata?: { name?: string }
  on?: { on: boolean }
  dimming?: { brightness: number }
  color?: { xy: { x: number; y: number } }
}

interface HueConnectivityResource {
  owner?: { rid: string }
  status?: string
}

/** CLIP v2 light resource → upsert input for Postgres. */
export function parseLightResource(light: HueLightResource, reachable: boolean): HueLightUpsert {
  const color = light.color?.xy ? xyToHsv(light.color.xy.x, light.color.xy.y) : undefined
  return {
    externalId: light.id,
    name: light.metadata?.name ?? light.id,
    reachable,
    ...(light.on !== undefined && { power: light.on.on }),
    ...(light.dimming !== undefined && { brightness: percentToByte(light.dimming.brightness) }),
    ...(color !== undefined && { hue: color.hue, saturation: color.saturation }),
  }
}

export function createHueClient(bridgeIp: string, appKey: string): HueClient {
  if (!bridgeIp || !appKey) {
    console.log("[hue] HUE_BRIDGE_IP / HUE_APP_KEY not set — Hue integration disabled")
    return {
      setLight: () => Promise.reject(new HueApiError("Hue integration disabled")),
      syncDevices: () => Promise.resolve(0),
      startPoll: () => {},
      stopPoll: () => {},
    }
  }

  // Hue Bridge serves a self-signed certificate on the LAN.
  const dispatcher = new Agent({ connect: { rejectUnauthorized: false } })

  async function request(method: string, path: string, body?: unknown): Promise<unknown> {
    const res = await fetch(`https://${bridgeIp}${path}`, {
      method,
      // Unroutable LAN IP hangs TCP connect — cap it so boot/poll never stall.
      signal: AbortSignal.timeout(10_000),
      headers: {
        "hue-application-key": appKey,
        ...(body !== undefined && { "content-type": "application/json" }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      // @ts-expect-error undici dispatcher option is not in the DOM fetch types
      dispatcher,
    })
    if (!res.ok) {
      throw new HueApiError(`Hue Bridge ${method} ${path} → ${res.status}`)
    }
    return res.json()
  }

  async function listResources<T>(type: string): Promise<T[]> {
    const json = (await request("GET", `/clip/v2/resource/${type}`)) as { data?: T[] }
    return json.data ?? []
  }

  async function syncDevices(): Promise<number> {
    const [lights, connectivity] = await Promise.all([
      listResources<HueLightResource>("light"),
      listResources<HueConnectivityResource>("zigbee_connectivity"),
    ])

    const reachableByOwner = new Map<string, boolean>()
    for (const c of connectivity) {
      if (c.owner?.rid) reachableByOwner.set(c.owner.rid, c.status === "connected")
    }

    for (const light of lights) {
      const reachable = light.owner?.rid ? (reachableByOwner.get(light.owner.rid) ?? true) : true
      await upsertHueLight(parseLightResource(light, reachable))
    }
    return lights.length
  }

  let pollTimer: NodeJS.Timeout | undefined

  return {
    async setLight(hueId, cmd) {
      await request("PUT", `/clip/v2/resource/light/${hueId}`, buildLightUpdateBody(cmd))
    },

    syncDevices,

    startPoll(intervalMs) {
      // setTimeout loop: no overlap possible — next tick schedules only after the
      // current sync completes (or fails). Cadence = "interval between end of sync",
      // which is fine for a reachability poll.
      const tick = async () => {
        try {
          await syncDevices()
        } catch (err) {
          // Poll failure ≠ devices offline — keep last known reachable.
          console.error("[hue] poll failed:", err instanceof Error ? err.message : err)
        }
        pollTimer = setTimeout(tick, intervalMs)
      }
      pollTimer = setTimeout(tick, intervalMs)
    },

    stopPoll() {
      if (pollTimer) clearTimeout(pollTimer)
    },
  }
}

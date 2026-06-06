// Thin wiring on top of the lumi-protocol `bridge/node` library (LumiCodec,
// LumiClient, DeviceRegistry). The library owns framing/CRC/ACK; this service does
// the wiring, the HTTP surface, and DB I/O (docs/bridge.md, CLAUDE.md rule 4).
//
// NOTE: `lumi-protocol` is an external repo not vendored here yet. Pin the
// dependency to the same git tag as `lumi-firmware` when wiring it in:
//
//   import { LumiClient, LumiCodec, DeviceRegistry } from "lumi-protocol/bridge/node"
//
// Until then this module exposes a placeholder shape so the service compiles.

export type LumiState = {
  power: boolean
  brightness: number
  hue: number
  saturation: number
  colorBrightness: number
  animId: number
}

export interface LumiBridge {
  setPower(deviceId: string, on: boolean): Promise<void>
  setBrightness(deviceId: string, brightness: number): Promise<void>
  setColor(deviceId: string, hue: number, saturation: number, brightness: number): Promise<void>
  setAnimation(deviceId: string, animId: number, speed: number, intensity: number): Promise<void>
  stopAnimation(deviceId: string): Promise<void>
  discover(): Promise<void>
}

// TODO: construct mqtt.connect(MQTT_URL) + new LumiClient(mqttClient, new LumiCodec()),
// hydrate a DeviceRegistry from PostgreSQL, and wire discovery/availability/state_report.
export function createLumiBridge(): LumiBridge {
  const notImplemented = async () => {
    throw new Error("lumi-protocol bridge/node not wired yet")
  }
  return {
    setPower: notImplemented,
    setBrightness: notImplemented,
    setColor: notImplemented,
    setAnimation: notImplemented,
    stopAnimation: notImplemented,
    discover: notImplemented,
  }
}

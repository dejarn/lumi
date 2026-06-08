import type { MqttClient } from "mqtt"
import {
  DeviceRegistry,
  LumiClient,
  LumiCodec,
  LumiTimeoutError,
  type AnimationIdValue,
  type LumiDevice,
  type LumiState as ProtocolLumiState,
} from "lumi-protocol"
import { upsertAndNotify, writeLightState, writeReachable } from "./state.js"

export { LumiTimeoutError }

export type LumiState = {
  power: boolean
  brightness: number
  hue: number
  saturation: number
  colorBrightness: number
  animId: number
  speed?: number
  intensity?: number
}

export interface LumiBridge {
  setPower(deviceId: string, on: boolean): Promise<void>
  setBrightness(deviceId: string, brightness: number): Promise<void>
  setColor(deviceId: string, hue: number, saturation: number, brightness: number): Promise<void>
  setAnimation(deviceId: string, animId: number, speed: number, intensity: number): Promise<void>
  stopAnimation(deviceId: string): Promise<void>
  setZone(deviceId: string, zone: number): Promise<void>
  discover(): Promise<void>
  hydrateRegistry(
    devices: { externalId: string; reachable: boolean; zone: number; protoVersion?: number | null }[],
  ): void
}

function deviceIdToExternalId(deviceId: number): string {
  return deviceId.toString(16).padStart(4, "0")
}

function externalIdToDeviceId(externalId: string): number {
  return parseInt(externalId, 16)
}

function mapProtocolState(state: ProtocolLumiState): Partial<LumiState> {
  return {
    power: state.power === 0x01,
    brightness: state.brightness,
    hue: state.h,
    saturation: state.s,
    colorBrightness: state.b,
    animId: state.animId,
  }
}

function toAnnounce(dev: LumiDevice) {
  return {
    deviceType: dev.deviceType,
    capabilities: dev.capabilities,
    protoVersion: dev.protoVersion,
    zoneId: dev.zoneId,
    name: dev.name,
  }
}

export function createLumiBridge(mqttClient: MqttClient): LumiBridge {
  const codec = new LumiCodec()
  const client = new LumiClient(mqttClient, codec)
  const registry = new DeviceRegistry()

  client.on("discovery", (dev) => {
    registry.upsert(dev.deviceId, toAnnounce(dev))
    void upsertAndNotify({
      externalId: deviceIdToExternalId(dev.deviceId),
      zone: dev.zoneId,
      protoVersion: dev.protoVersion,
    })
  })

  client.on("availability", (deviceId, online) => {
    registry.setReachable(deviceId, online)
    void writeReachable(deviceIdToExternalId(deviceId), online)
  })

  client.on("state_report", (deviceId, state) => {
    void writeLightState(deviceIdToExternalId(deviceId), mapProtocolState(state))
  })

  return {
    setPower: (externalId, on) => client.setPower(externalIdToDeviceId(externalId), on),

    setBrightness: (externalId, brightness) =>
      client.setBrightness(externalIdToDeviceId(externalId), brightness),

    setColor: (externalId, hue, saturation, brightness) =>
      client.setColor(externalIdToDeviceId(externalId), { h: hue, s: saturation, b: brightness }),

    async setAnimation(externalId, animId, speed, intensity) {
      await client.setAnimation(externalIdToDeviceId(externalId), animId as AnimationIdValue, {
        speed,
        intensity,
      })
      await writeLightState(externalId, { animId, speed, intensity })
    },

    stopAnimation: (externalId) => client.stopAnimation(externalIdToDeviceId(externalId)),

    setZone: (externalId, zone) => client.setZone(externalIdToDeviceId(externalId), zone),

    async discover() {
      client.discover()
    },

    hydrateRegistry(devices) {
      for (const d of devices) {
        const deviceId = externalIdToDeviceId(d.externalId)
        registry.upsert(deviceId, {
          deviceType: 0,
          capabilities: 0,
          protoVersion: d.protoVersion ?? 1,
          zoneId: d.zone,
          name: d.externalId,
        })
        registry.setReachable(deviceId, d.reachable)
      }
    },
  }
}

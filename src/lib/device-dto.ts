import type { Device } from "@prisma/client"

/** Public device fields per docs/api.md — omits internal columns. */
export function toDeviceDto(device: Device) {
  return {
    id: device.id,
    name: device.name,
    kind: device.kind,
    protocol: device.protocol,
    reachable: device.reachable,
    zone: device.zone,
    power: device.power,
    brightness: device.brightness,
    hue: device.hue,
    saturation: device.saturation,
    colorBrightness: device.colorBrightness,
    animId: device.animId,
    animSpeed: device.animSpeed,
    animIntensity: device.animIntensity,
    sensorActive: device.sensorActive,
    lastSeen: device.lastSeen,
  }
}

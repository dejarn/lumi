import type { MqttClient } from "mqtt" // unused here; kept for module consistency

// Future Hue REST v2 integration:
// - PUT  https://{bridgeIp}/clip/v2/resource/light/{hueId}  — setLight (on, dimming, color)
// - GET  https://{bridgeIp}/clip/v2/resource/light          — pollReachable (reachable field)
// - Header: hue-application-key: {appKey}
// - TLS: bridge uses a self-signed cert; ignore verification in production client

export interface HueLightCommand {
  power?: boolean
  brightness?: number // 0–255 (convert to 0–100% for Hue dimming on implementation)
  hue?: number // 0–65535 (convert to CIE xy on implementation)
  saturation?: number // 0–255
}

export interface HueClient {
  setLight(hueId: string, cmd: HueLightCommand): Promise<void>
  pollReachable(): Promise<void>
  startPoll(intervalMs: number): void
}

export function createHueClient(_bridgeIp: string, _appKey: string): HueClient {
  return {
    setLight(_hueId, _cmd) {
      console.log("[hue] not implemented")
      return Promise.resolve()
    },

    pollReachable() {
      console.log("[hue] not implemented")
      return Promise.resolve()
    },

    startPoll(_intervalMs) {
      console.log("[hue] not implemented")
    },
  }
}

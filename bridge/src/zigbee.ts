import type { MqttClient } from "mqtt"

// STUB — Zigbee integration not yet implemented (planned v1.x).
// Until implemented:
//   - No Zigbee sensor state or reachability is written to PostgreSQL.
//   - SENSOR triggers cannot fire from Zigbee events in production.
//
// Future implementation notes:
// - Subscribe: zigbee2mqtt/+  — device state and availability payloads
// - Ignore:    zigbee2mqtt/bridge/...  — bridge meta topics, not device events
// - resolveDeviceUuid (state.ts:21-30) looks up LUMI protocol only; a Zigbee
//   implementation should either parameterise it as resolveDeviceUuid(id, protocol)
//   or introduce a dedicated writeSensorStateZ2m function.

export function setupZigbee(_mqttClient: MqttClient): void {
  console.log("[zigbee] not implemented — stub only")
}

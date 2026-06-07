import type { MqttClient } from "mqtt"

// Future Zigbee2MQTT integration:
// - Subscribe: zigbee2mqtt/+  — device state and availability payloads
// - Ignore:    zigbee2mqtt/bridge/...  — bridge meta topics, not device events

export function setupZigbee(_mqttClient: MqttClient): void {
  console.log("[zigbee] not implemented")
}

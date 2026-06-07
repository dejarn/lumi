import type { DeviceCommand } from "@/lib/types"

export async function postCommand(deviceId: string, command: DeviceCommand): Promise<void> {
  await fetch(`/api/devices/${deviceId}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  })
}

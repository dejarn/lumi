import type { DeviceCommand } from "@/lib/types"

// Best-effort command (docs: routes return 202). Resolves to whether the request
// was accepted; callers surface a degraded toast on failure. Confirmed state still
// arrives async over SSE.
export async function postCommand(deviceId: string, command: DeviceCommand): Promise<boolean> {
  try {
    const res = await fetch(`/api/devices/${deviceId}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
    })
    return res.ok
  } catch {
    return false
  }
}

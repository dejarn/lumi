import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import type { LumiState } from "./lumi.js"

// PostgreSQL is the single source of truth. Every inbound device event is written
// here, then a `NOTIFY device_state, '<deviceId>'` wakes the Next.js SSE handler
// (docs/bridge.md#real-time-state-back-to-the-browser).

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
export const db = new PrismaClient({ adapter })

async function notify(deviceId: string): Promise<void> {
  // NOTIFY payload is the deviceId. The SSE handler reads the row and pushes a patch.
  await db.$queryRaw`SELECT pg_notify('device_state', ${deviceId})`
}

/** STATE_REPORT (LUMI) / Hue event → Device light columns. */
export async function writeLightState(deviceId: string, state: Partial<LumiState>): Promise<void> {
  await db.device.update({ where: { id: deviceId }, data: { ...state, lastSeen: new Date() } })
  await notify(deviceId)
}

/** Zigbee2MQTT message → Device.sensorActive. */
export async function writeSensorState(deviceId: string, active: boolean): Promise<void> {
  await db.device.update({
    where: { id: deviceId },
    data: { sensorActive: active, lastSeen: new Date() },
  })
  await notify(deviceId)
}

/** Availability channel (LUMI LWT / z2m availability / Hue poll) → Device.reachable. */
export async function writeReachable(deviceId: string, reachable: boolean): Promise<void> {
  await db.device.update({ where: { id: deviceId }, data: { reachable } })
  await notify(deviceId)
}

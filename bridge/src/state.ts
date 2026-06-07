import { DeviceKind, PrismaClient, Protocol } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import type { LumiState } from "./lumi.js"

// PostgreSQL is the single source of truth. Every inbound device event is written
// here, then a `NOTIFY device_state, '<deviceId>'` wakes the Next.js SSE handler
// (docs/bridge.md#real-time-state-back-to-the-browser).

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
export const db = new PrismaClient({ adapter })

async function notify(deviceUuid: string): Promise<void> {
  // NOTIFY payload is the device UUID PK. The SSE handler reads the row and pushes a patch.
  await db.$executeRaw`SELECT pg_notify('device_state', ${deviceUuid})`
}

async function resolveDeviceUuid(deviceId: string): Promise<string | null> {
  const byPk = await db.device.findUnique({ where: { id: deviceId }, select: { id: true } })
  if (byPk) return byPk.id

  const byExternal = await db.device.findUnique({
    where: { protocol_externalId: { protocol: Protocol.LUMI, externalId: deviceId } },
    select: { id: true },
  })
  return byExternal?.id ?? null
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

/** STATE_REPORT (LUMI) / Hue event → Device light columns. `deviceId` = LUMI externalId or UUID. */
export async function writeLightState(deviceId: string, state: Partial<LumiState>): Promise<void> {
  const id = await resolveDeviceUuid(deviceId)
  if (!id) return

  const { speed, intensity, ...lightState } = state
  await db.device.update({
    where: { id },
    data: {
      ...lightState,
      ...(speed !== undefined && { animSpeed: speed }),
      ...(intensity !== undefined && { animIntensity: intensity }),
      lastSeen: new Date(),
    },
  })
  await notify(id)
}

/** Zigbee2MQTT message → Device.sensorActive. */
export async function writeSensorState(deviceId: string, active: boolean): Promise<void> {
  const id = await resolveDeviceUuid(deviceId)
  if (!id) return

  await db.device.update({
    where: { id },
    data: { sensorActive: active, lastSeen: new Date() },
  })
  await notify(id)
}

/** Availability channel (LUMI LWT / z2m availability / Hue poll) → Device.reachable. */
export async function writeReachable(deviceId: string, reachable: boolean): Promise<void> {
  const existingId = await resolveDeviceUuid(deviceId)
  if (existingId) {
    await db.device.update({ where: { id: existingId }, data: { reachable } })
    await notify(existingId)
    return
  }

  // Hue/Zigbee callers pass UUID; skip if the row is not known yet.
  if (isUuid(deviceId)) return

  // LUMI LWT can arrive before DISCOVERY_ANNOUNCE — create a minimal row.
  const created = await db.device.create({
    data: {
      name: deviceId,
      protocol: Protocol.LUMI,
      externalId: deviceId,
      kind: DeviceKind.LIGHT,
      reachable,
    },
  })
  await notify(created.id)
}

/** Boot-time hydration of the LUMI DeviceRegistry. */
export async function listLumiDevices(): Promise<
  { externalId: string; reachable: boolean; zone: number; protoVersion: number | null }[]
> {
  return db.device.findMany({
    where: { protocol: Protocol.LUMI },
    select: { externalId: true, reachable: true, zone: true, protoVersion: true },
  })
}

/** DISCOVERY_ANNOUNCE → upsert LUMI row. Does not NOTIFY (no light/sensor state change). */
export async function upsertDevice(dev: {
  externalId: string
  zone?: number
  protoVersion?: number
}): Promise<void> {
  await db.device.upsert({
    where: {
      protocol_externalId: { protocol: Protocol.LUMI, externalId: dev.externalId },
    },
    create: {
      name: dev.externalId,
      protocol: Protocol.LUMI,
      externalId: dev.externalId,
      kind: DeviceKind.LIGHT,
      zone: dev.zone ?? 0,
      protoVersion: dev.protoVersion,
      lastSeen: new Date(),
      reachable: true,
    },
    update: {
      ...(dev.zone !== undefined && { zone: dev.zone }),
      ...(dev.protoVersion !== undefined && { protoVersion: dev.protoVersion }),
      lastSeen: new Date(),
      reachable: true,
    },
  })
}

/** HTTP command routing lookup by device PK. */
export async function getDevice(id: string): Promise<{
  protocol: Protocol
  kind: DeviceKind
  externalId: string
} | null> {
  return db.device.findUnique({
    where: { id },
    select: { protocol: true, kind: true, externalId: true },
  })
}

/** Liveness probe for /health — throws if DB is unreachable. */
export async function dbPing(): Promise<void> {
  await db.$queryRaw`SELECT 1`
}

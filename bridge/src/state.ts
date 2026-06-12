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

function warnDeviceNotFound(deviceId: string, scope: string): void {
  console.warn(JSON.stringify({ scope, msg: "device not found", deviceId }))
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
  if (!id) {
    warnDeviceNotFound(deviceId, "writeLightState")
    return
  }

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
  if (!id) {
    warnDeviceNotFound(deviceId, "writeSensorState")
    return
  }

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
  if (isUuid(deviceId)) {
    warnDeviceNotFound(deviceId, "writeReachable")
    return
  }

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

/** Persist LUMI zone and NOTIFY SSE consumers. */
export async function writeZone(deviceId: string, zone: number): Promise<void> {
  const id = await resolveDeviceUuid(deviceId)
  if (!id) {
    warnDeviceNotFound(deviceId, "writeZone")
    return
  }
  await db.device.update({ where: { id }, data: { zone } })
  await notify(id)
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

/** DISCOVERY_ANNOUNCE → upsert LUMI row and NOTIFY. */
export async function upsertAndNotify(dev: {
  externalId: string
  zone?: number
  protoVersion?: number
}): Promise<void> {
  const row = await db.device.upsert({
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
    },
    select: { id: true },
  })
  await notify(row.id)
}

export interface HueLightUpsert {
  externalId: string
  name: string
  reachable: boolean
  power?: boolean
  brightness?: number
  hue?: number
  saturation?: number
}

/** Hue poll/sync → upsert HUE row; NOTIFY only when visible state changed. */
export async function upsertHueLight(input: HueLightUpsert): Promise<void> {
  const where = {
    protocol_externalId: { protocol: Protocol.HUE, externalId: input.externalId },
  }
  const existing = await db.device.findUnique({
    where,
    select: { id: true, power: true, brightness: true, hue: true, saturation: true, reachable: true },
  })

  const state = {
    ...(input.power !== undefined && { power: input.power }),
    ...(input.brightness !== undefined && { brightness: input.brightness }),
    ...(input.hue !== undefined && { hue: input.hue }),
    ...(input.saturation !== undefined && { saturation: input.saturation }),
    reachable: input.reachable,
  }

  if (!existing) {
    const created = await db.device.create({
      data: {
        // Admin renames later via the app — Hue name only seeds the row.
        name: input.name,
        protocol: Protocol.HUE,
        externalId: input.externalId,
        kind: DeviceKind.LIGHT,
        lastSeen: new Date(),
        ...state,
      },
      select: { id: true },
    })
    await notify(created.id)
    return
  }

  const changed =
    (input.power !== undefined && existing.power !== input.power) ||
    (input.brightness !== undefined && existing.brightness !== input.brightness) ||
    (input.hue !== undefined && existing.hue !== input.hue) ||
    (input.saturation !== undefined && existing.saturation !== input.saturation) ||
    existing.reachable !== input.reachable

  await db.device.update({
    where: { id: existing.id },
    data: { ...state, lastSeen: new Date() },
  })
  if (changed) await notify(existing.id)
}

/** @deprecated Use upsertAndNotify */
export async function upsertDevice(dev: {
  externalId: string
  zone?: number
  protoVersion?: number
}): Promise<void> {
  return upsertAndNotify(dev)
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

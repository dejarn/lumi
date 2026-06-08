import "dotenv/config"

import { DeviceKind, PrismaClient, Protocol } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

type LightSeed = {
  name: string
  externalId: string
  zone: number
  power: boolean
  brightness: number
  hue: number
  saturation: number
  colorBrightness: number
}

const lumiLights: LightSeed[] = [
  {
    name: "Salon strip",
    externalId: "0001",
    zone: 1,
    power: true,
    brightness: 200,
    hue: 8000,
    saturation: 180,
    colorBrightness: 255,
  },
  {
    name: "Chambre strip",
    externalId: "0002",
    zone: 2,
    power: false,
    brightness: 0,
    hue: 0,
    saturation: 0,
    colorBrightness: 0,
  },
  {
    name: "Cuisine strip",
    externalId: "0003",
    zone: 3,
    power: true,
    brightness: 128,
    hue: 30000,
    saturation: 220,
    colorBrightness: 200,
  },
]

const lightFields = (light: LightSeed) => ({
  name: light.name,
  kind: DeviceKind.LIGHT,
  zone: light.zone,
  reachable: true,
  protoVersion: 1,
  power: light.power,
  brightness: light.brightness,
  hue: light.hue,
  saturation: light.saturation,
  colorBrightness: light.colorBrightness,
  animId: 0,
  animSpeed: null,
  animIntensity: null,
  sensorActive: null,
})

async function main() {
  for (const light of lumiLights) {
    const data = lightFields(light)
    await prisma.device.upsert({
      where: {
        protocol_externalId: { protocol: Protocol.LUMI, externalId: light.externalId },
      },
      create: { protocol: Protocol.LUMI, externalId: light.externalId, ...data },
      update: data,
    })
  }

  await prisma.device.upsert({
    where: {
      protocol_externalId: { protocol: Protocol.ZIGBEE, externalId: "presence-salon" },
    },
    create: {
      protocol: Protocol.ZIGBEE,
      externalId: "presence-salon",
      name: "Présence salon",
      kind: DeviceKind.SENSOR,
      zone: 0,
      reachable: true,
      sensorActive: false,
    },
    update: {
      name: "Présence salon",
      kind: DeviceKind.SENSOR,
      zone: 0,
      reachable: true,
      sensorActive: false,
    },
  })

  const count = await prisma.device.count()
  console.log(`Seeded ${lumiLights.length} LUMI lights + 1 ZIGBEE sensor (${count} devices total)`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

import { prisma } from "@/lib/prisma"
import DashboardClient from "@/components/DashboardClient"

// Two sections — Lights then Sensors. Flat 2-column grid (docs/frontend.md).
export default async function DashboardPage() {
  const [lights, sensors] = await Promise.all([
    prisma.device.findMany({ where: { kind: "LIGHT" }, orderBy: { name: "asc" } }),
    prisma.device.findMany({ where: { kind: "SENSOR" }, orderBy: { name: "asc" } }),
  ])

  return <DashboardClient lights={lights} sensors={sensors} />
}

import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/get-session"
import DashboardClient from "@/components/DashboardClient"

type PageProps = {
  searchParams: Promise<{ capture?: string }>
}

// Two sections — Lights then Sensors. Flat 2-column grid (docs/frontend.md).
export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await getSession()
  const { capture } = await searchParams
  const isAdmin = session?.user.role === "ADMIN"

  const [lights, sensors] = await Promise.all([
    prisma.device.findMany({ where: { kind: "LIGHT" }, orderBy: { name: "asc" } }),
    prisma.device.findMany({ where: { kind: "SENSOR" }, orderBy: { name: "asc" } }),
  ])

  return (
    <DashboardClient
      lights={lights}
      sensors={sensors}
      isAdmin={isAdmin}
      captureSceneId={capture ?? null}
    />
  )
}

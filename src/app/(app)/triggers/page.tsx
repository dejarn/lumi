import Box from "@mui/material/Box"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/get-session"
import TriggersClient from "@/components/TriggersClient"
import PageHeader from "@/components/ui/PageHeader"
import PageSection from "@/components/ui/PageSection"

export default async function TriggersPage() {
  const session = await getSession()
  const isAdmin = session?.user.role === "ADMIN"

  const [triggers, scenes, sensorDevices] = await Promise.all([
    prisma.trigger.findMany({
      include: { scene: true },
      orderBy: { name: "asc" },
    }),
    prisma.scene.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.device.findMany({
      where: { kind: "SENSOR" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <PageHeader title="Déclencheurs" />
      <PageSection>
        <TriggersClient
          triggers={triggers}
          scenes={scenes}
          sensorDevices={sensorDevices}
          isAdmin={isAdmin}
        />
      </PageSection>
    </Box>
  )
}

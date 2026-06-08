import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Divider from "@mui/material/Divider"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/get-session"
import TriggerForm from "@/components/TriggerForm"
import TriggerList from "@/components/TriggerList"
import StateCard from "@/components/ui/StateCard"

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
      <Typography variant="h5">Déclencheurs</Typography>
      {triggers.length === 0 ? (
        <StateCard icon="◷" title="Aucun déclencheur" />
      ) : (
        <TriggerList triggers={triggers} />
      )}

      {isAdmin && (
        <>
          <Divider />
          <Typography variant="h6">Nouveau déclencheur</Typography>
          <TriggerForm scenes={scenes} sensorDevices={sensorDevices} />
        </>
      )}
    </Box>
  )
}

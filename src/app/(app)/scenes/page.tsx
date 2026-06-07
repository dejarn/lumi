import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/get-session"
import { averageColor } from "@/lib/color"
import ScenesGrid from "@/components/ScenesGrid"

export default async function ScenesPage() {
  const session = await getSession()
  const isAdmin = session?.user.role === "ADMIN"

  const scenes = await prisma.scene.findMany({
    include: { sceneDevices: true },
    orderBy: { name: "asc" },
  })

  const scenesWithColor = scenes.map((scene) => ({
    scene: { id: scene.id, name: scene.name, createdAt: scene.createdAt },
    deviceCount: scene.sceneDevices.length,
    averageColor: averageColor(
      scene.sceneDevices.map((d) => ({
        hue: d.hue,
        saturation: d.saturation,
        colorBrightness: d.colorBrightness,
      })),
    ),
  }))

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="h5">Scènes</Typography>
      <ScenesGrid scenes={scenesWithColor} isAdmin={isAdmin} />
    </Box>
  )
}

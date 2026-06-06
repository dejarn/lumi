import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import { prisma } from "@/lib/prisma"
import SceneCard from "@/components/SceneCard"

export default async function ScenesPage() {
  const scenes = await prisma.scene.findMany({ orderBy: { name: "asc" } })

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="h5">Scènes</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1.5 }}>
        {scenes.map((scene) => (
          <SceneCard key={scene.id} scene={scene} />
        ))}
        {scenes.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Aucune scène. Les admins peuvent en créer.
          </Typography>
        )}
      </Box>
    </Box>
  )
}

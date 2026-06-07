"use client"

import type { Scene } from "@prisma/client"
import Card from "@mui/material/Card"
import CardActionArea from "@mui/material/CardActionArea"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import PlayArrowIcon from "@mui/icons-material/PlayArrow"
import { glowStyle } from "@/lib/tokens"

type SceneCardProps = {
  scene: Scene
  averageColor: string
  deviceCount: number
  active: boolean
  onActivate?: (sceneId: string) => void
}

async function activate(sceneId: string, averageColor: string) {
  await fetch(`/api/scenes/${sceneId}/activate`, { method: "POST" })
  document.documentElement.style.setProperty("--lumi-ambient", averageColor)
}

export default function SceneCard({
  scene,
  averageColor,
  deviceCount,
  active,
  onActivate,
}: SceneCardProps) {
  const glow = active ? glowStyle.accent : glowStyle.none
  return (
    <Card sx={{ borderColor: glow.borderColor, boxShadow: glow.boxShadow }}>
      <CardActionArea
        onClick={() => {
          onActivate?.(scene.id)
          void activate(scene.id, averageColor)
        }}
        sx={{ p: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontSize: "1rem" }}>
            {scene.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {deviceCount} appareil{deviceCount !== 1 ? "s" : ""}
            {active ? " · active" : ""}
          </Typography>
        </Box>
        <PlayArrowIcon sx={{ color: active ? "primary.main" : "text.secondary" }} />
      </CardActionArea>
    </Card>
  )
}

"use client"

import type { Scene } from "@prisma/client"
import Card from "@mui/material/Card"
import CardActionArea from "@mui/material/CardActionArea"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import { glowStyle } from "@/lib/tokens"

type SceneCardProps = {
  scene: Scene
  averageColor: string
  deviceCount: number
  onOpen: (sceneId: string) => void
}

export default function SceneCard({ scene, averageColor, deviceCount, onOpen }: SceneCardProps) {
  const pastilleColor = averageColor !== "transparent" ? averageColor : "rgba(255,255,255,0.12)"

  return (
    <Card sx={{ borderColor: glowStyle.none.borderColor, boxShadow: glowStyle.none.boxShadow }}>
      <CardActionArea
        onClick={() => onOpen(scene.id)}
        sx={{ p: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontSize: "1rem" }}>
            {scene.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {deviceCount} appareil{deviceCount !== 1 ? "s" : ""}
          </Typography>
        </Box>
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            flexShrink: 0,
            backgroundColor: pastilleColor,
            border: "1px solid",
            borderColor: pastilleColor,
          }}
        />
      </CardActionArea>
    </Card>
  )
}

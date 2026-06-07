"use client"

import type { Scene } from "@prisma/client"
import Card from "@mui/material/Card"
import CardActionArea from "@mui/material/CardActionArea"
import CardContent from "@mui/material/CardContent"
import Typography from "@mui/material/Typography"

type SceneCardProps = {
  scene: Scene
  averageColor: string
  active: boolean
  onActivate?: (sceneId: string) => void
}

async function activate(sceneId: string, averageColor: string) {
  await fetch(`/api/scenes/${sceneId}/activate`, { method: "POST" })
  document.documentElement.style.setProperty("--lumi-ambient", averageColor)
}

export default function SceneCard({ scene, averageColor, active, onActivate }: SceneCardProps) {
  return (
    <Card
      sx={{
        border: "1px solid",
        borderColor: active ? "primary.main" : "divider",
        boxShadow: active ? "inset 0 0 24px rgba(242,180,58,0.18)" : "none",
      }}
    >
      <CardActionArea
        onClick={() => {
          onActivate?.(scene.id)
          void activate(scene.id, averageColor)
        }}
      >
        <CardContent>
          <Typography variant="subtitle1">{scene.name}</Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}

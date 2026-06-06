"use client"

import type { Scene } from "@prisma/client"
import Card from "@mui/material/Card"
import CardActionArea from "@mui/material/CardActionArea"
import CardContent from "@mui/material/CardContent"
import Typography from "@mui/material/Typography"

async function activate(sceneId: string) {
  await fetch(`/api/scenes/${sceneId}/activate`, { method: "POST" })
}

export default function SceneCard({ scene }: { scene: Scene }) {
  // TODO: luminous active border + ambient canvas shift toward scene's average colour.
  return (
    <Card>
      <CardActionArea onClick={() => activate(scene.id)}>
        <CardContent>
          <Typography variant="subtitle1">{scene.name}</Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}

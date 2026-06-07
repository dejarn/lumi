"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { Scene } from "@prisma/client"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Dialog from "@mui/material/Dialog"
import DialogTitle from "@mui/material/DialogTitle"
import DialogContent from "@mui/material/DialogContent"
import DialogActions from "@mui/material/DialogActions"
import TextField from "@mui/material/TextField"
import SceneCard from "@/components/SceneCard"

export type SceneWithColor = {
  scene: Scene
  averageColor: string
}

type ScenesGridProps = {
  scenes: SceneWithColor[]
  isAdmin: boolean
}

export default function ScenesGrid({ scenes, isAdmin }: ScenesGridProps) {
  const router = useRouter()
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) return
    setCreating(true)
    const res = await fetch("/api/scenes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    })
    setCreating(false)
    if (res.ok) {
      setCreateOpen(false)
      setName("")
      router.refresh()
    }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {isAdmin && (
        <Box>
          <Button variant="outlined" onClick={() => setCreateOpen(true)}>
            Nouvelle scène
          </Button>
        </Box>
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1.5 }}>
        {scenes.map(({ scene, averageColor }) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            averageColor={averageColor}
            active={activeSceneId === scene.id}
            onActivate={setActiveSceneId}
          />
        ))}
      </Box>

      {isAdmin && scenes.length > 0 && (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {scenes.map(({ scene }) => (
            <Button
              key={scene.id}
              size="small"
              variant="text"
              onClick={() => router.push(`/dashboard?capture=${scene.id}`)}
            >
              Capturer · {scene.name}
            </Button>
          ))}
        </Box>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Nouvelle scène</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nom"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Annuler</Button>
          <Button onClick={handleCreate} disabled={creating || !name.trim()}>
            Créer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

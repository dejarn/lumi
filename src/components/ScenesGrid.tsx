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
import SceneSheet from "@/components/SceneSheet"
import StateCard from "@/components/ui/StateCard"

export type SceneWithColor = {
  scene: Scene
  averageColor: string
  deviceCount: number
}

type ScenesGridProps = {
  scenes: SceneWithColor[]
  isAdmin: boolean
}

export default function ScenesGrid({ scenes, isAdmin }: ScenesGridProps) {
  const router = useRouter()
  const [openSceneId, setOpenSceneId] = useState<string | null>(null)
  const [startInEditMode, setStartInEditMode] = useState(false)
  const [pendingSceneName, setPendingSceneName] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [creating, setCreating] = useState(false)

  const openScene = openSceneId ? scenes.find(({ scene }) => scene.id === openSceneId) : undefined
  const openSceneName = openScene?.scene.name ?? pendingSceneName

  function closeSheet() {
    setOpenSceneId(null)
    setStartInEditMode(false)
    setPendingSceneName("")
  }

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
      const scene = (await res.json()) as Scene
      setCreateOpen(false)
      setName("")
      setPendingSceneName(scene.name)
      setOpenSceneId(scene.id)
      setStartInEditMode(true)
      router.refresh()
    }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {isAdmin && scenes.length > 0 && (
        <Box>
          <Button variant="outlined" onClick={() => setCreateOpen(true)}>
            Nouvelle scène
          </Button>
        </Box>
      )}

      {scenes.length === 0 ? (
        <StateCard
          icon="◇"
          title="Aucune scène"
          description="Règle tes lumières puis capture l'état pour créer une scène."
          actionLabel={isAdmin ? "Nouvelle scène" : undefined}
          onAction={isAdmin ? () => setCreateOpen(true) : undefined}
        />
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {scenes.map(({ scene, averageColor, deviceCount }) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              averageColor={averageColor}
              deviceCount={deviceCount}
              onOpen={setOpenSceneId}
            />
          ))}
        </Box>
      )}

      <SceneSheet
        open={openSceneId !== null}
        sceneId={openSceneId ?? ""}
        sceneName={openSceneName}
        isAdmin={isAdmin}
        startInEditMode={startInEditMode}
        onClose={closeSheet}
      />

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

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { Scene } from "@prisma/client"
import Card from "@mui/material/Card"
import CardActionArea from "@mui/material/CardActionArea"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import IconButton from "@mui/material/IconButton"
import Menu from "@mui/material/Menu"
import MenuItem from "@mui/material/MenuItem"
import Dialog from "@mui/material/Dialog"
import DialogTitle from "@mui/material/DialogTitle"
import DialogContent from "@mui/material/DialogContent"
import DialogActions from "@mui/material/DialogActions"
import TextField from "@mui/material/TextField"
import Button from "@mui/material/Button"
import PlayArrowIcon from "@mui/icons-material/PlayArrow"
import MoreVertIcon from "@mui/icons-material/MoreVert"
import { glowStyle } from "@/lib/tokens"

type SceneCardProps = {
  scene: Scene
  averageColor: string
  deviceCount: number
  active: boolean
  isAdmin?: boolean
  onActivate?: (sceneId: string) => void
}

function ambientRgba(hex: string): string {
  if (!hex.startsWith("#") || hex.length < 7) return "rgba(255,150,60,0.10)"
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},0.10)`
}

async function activate(sceneId: string, averageColor: string) {
  const res = await fetch(`/api/scenes/${sceneId}/activate`, { method: "POST" })
  if (res.ok) {
    document.documentElement.style.setProperty("--lumi-ambient", ambientRgba(averageColor))
  }
}

export default function SceneCard({
  scene,
  averageColor,
  deviceCount,
  active,
  isAdmin = false,
  onActivate,
}: SceneCardProps) {
  const router = useRouter()
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState(scene.name)
  const [busy, setBusy] = useState(false)

  const glow = active ? glowStyle.accent : glowStyle.none

  async function handleRename() {
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    const res = await fetch(`/api/scenes/${scene.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    })
    setBusy(false)
    if (res.ok) {
      setRenameOpen(false)
      router.refresh()
    }
  }

  async function handleDelete() {
    setBusy(true)
    const res = await fetch(`/api/scenes/${scene.id}`, { method: "DELETE" })
    setBusy(false)
    if (res.ok) {
      setDeleteOpen(false)
      router.refresh()
    }
  }

  return (
    <>
      <Card sx={{ borderColor: glow.borderColor, boxShadow: glow.boxShadow, position: "relative" }}>
        {isAdmin && (
          <IconButton
            size="small"
            sx={{ position: "absolute", top: 4, right: 4, zIndex: 2 }}
            onClick={(e) => {
              e.stopPropagation()
              setMenuAnchor(e.currentTarget)
            }}
            aria-label="Options scène"
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        )}
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

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            setName(scene.name)
            setRenameOpen(true)
          }}
        >
          Renommer
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            setDeleteOpen(true)
          }}
        >
          Supprimer
        </MenuItem>
      </Menu>

      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Renommer la scène</DialogTitle>
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
          <Button onClick={() => setRenameOpen(false)}>Annuler</Button>
          <Button onClick={() => void handleRename()} disabled={busy || !name.trim()}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Supprimer « {scene.name} » ?</DialogTitle>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Annuler</Button>
          <Button color="error" onClick={() => void handleDelete()} disabled={busy}>
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

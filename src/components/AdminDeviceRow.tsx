"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { Device } from "@prisma/client"
import ListItem from "@mui/material/ListItem"
import ListItemText from "@mui/material/ListItemText"
import IconButton from "@mui/material/IconButton"
import Dialog from "@mui/material/Dialog"
import DialogTitle from "@mui/material/DialogTitle"
import DialogContent from "@mui/material/DialogContent"
import DialogActions from "@mui/material/DialogActions"
import TextField from "@mui/material/TextField"
import Button from "@mui/material/Button"
import Box from "@mui/material/Box"
import EditIcon from "@mui/icons-material/Edit"
import GridOnIcon from "@mui/icons-material/GridOn"
import DeleteIcon from "@mui/icons-material/Delete"

export default function AdminDeviceRow({ device }: { device: Device }) {
  const router = useRouter()
  const [renameOpen, setRenameOpen] = useState(false)
  const [zoneOpen, setZoneOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState(device.name)
  const [zone, setZone] = useState(String(device.zone))
  const [loading, setLoading] = useState(false)

  async function handleRename() {
    const trimmed = name.trim()
    if (!trimmed) return
    setLoading(true)
    const res = await fetch(`/api/devices/${device.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    })
    setLoading(false)
    if (res.ok) {
      setRenameOpen(false)
      router.refresh()
    }
  }

  async function handleZone() {
    const zoneNum = parseInt(zone, 10)
    if (!Number.isInteger(zoneNum)) return
    setLoading(true)
    const res = await fetch(`/api/devices/${device.id}/zone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zone: zoneNum }),
    })
    setLoading(false)
    if (res.ok) {
      setZoneOpen(false)
      router.refresh()
    }
  }

  async function handleDelete() {
    setLoading(true)
    const res = await fetch(`/api/devices/${device.id}`, { method: "DELETE" })
    setLoading(false)
    if (res.ok) {
      setDeleteOpen(false)
      router.refresh()
    }
  }

  return (
    <>
      <ListItem
        divider
        secondaryAction={
          <Box>
            <IconButton
              aria-label="Renommer"
              onClick={() => {
                setName(device.name)
                setRenameOpen(true)
              }}
            >
              <EditIcon />
            </IconButton>
            {device.protocol === "LUMI" && (
              <IconButton
                aria-label="Zone"
                onClick={() => {
                  setZone(String(device.zone))
                  setZoneOpen(true)
                }}
              >
                <GridOnIcon />
              </IconButton>
            )}
            <IconButton aria-label="Supprimer" onClick={() => setDeleteOpen(true)}>
              <DeleteIcon />
            </IconButton>
          </Box>
        }
      >
        <ListItemText
          primary={device.name}
          secondary={`${device.protocol} · ${device.kind} · zone ${device.zone} · ${device.reachable ? "en ligne" : "hors ligne"}`}
        />
      </ListItem>

      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Renommer</DialogTitle>
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
          <Button onClick={handleRename} disabled={loading || !name.trim()}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={zoneOpen} onClose={() => setZoneOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Définir la zone</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Zone"
            type="number"
            fullWidth
            value={zone}
            onChange={(e) => setZone(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setZoneOpen(false)}>Annuler</Button>
          <Button onClick={handleZone} disabled={loading}>
            Appliquer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Supprimer l&apos;appareil</DialogTitle>
        <DialogContent>
          Supprimer « {device.name} » ? Cette action est irréversible.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Annuler</Button>
          <Button color="error" onClick={handleDelete} disabled={loading}>
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

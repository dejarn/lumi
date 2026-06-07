"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { Role } from "@prisma/client"
import ListItem from "@mui/material/ListItem"
import ListItemText from "@mui/material/ListItemText"
import FormControl from "@mui/material/FormControl"
import Select from "@mui/material/Select"
import MenuItem from "@mui/material/MenuItem"
import Switch from "@mui/material/Switch"
import IconButton from "@mui/material/IconButton"
import Dialog from "@mui/material/Dialog"
import DialogTitle from "@mui/material/DialogTitle"
import DialogContent from "@mui/material/DialogContent"
import DialogActions from "@mui/material/DialogActions"
import Button from "@mui/material/Button"
import Box from "@mui/material/Box"
import DeleteIcon from "@mui/icons-material/Delete"

type UserRow = {
  id: string
  username: string
  role: Role
  active: boolean
}

export default function AdminUserRow({ user }: { user: UserRow }) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function patch(data: { role?: Role; active?: boolean }) {
    setLoading(true)
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    setLoading(false)
    if (res.ok) router.refresh()
  }

  async function handleDelete() {
    setLoading(true)
    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" })
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
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <Select
                value={user.role}
                disabled={loading}
                onChange={(e) => patch({ role: e.target.value as Role })}
              >
                <MenuItem value="USER">USER</MenuItem>
                <MenuItem value="ADMIN">ADMIN</MenuItem>
              </Select>
            </FormControl>
            <Switch
              checked={user.active}
              disabled={loading}
              onChange={(e) => patch({ active: e.target.checked })}
              slotProps={{ input: { "aria-label": "Actif" } }}
            />
            <IconButton aria-label="Supprimer" onClick={() => setDeleteOpen(true)} disabled={loading}>
              <DeleteIcon />
            </IconButton>
          </Box>
        }
      >
        <ListItemText
          primary={user.username}
          secondary={user.active ? user.role : `${user.role} · désactivé`}
        />
      </ListItem>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Supprimer l&apos;utilisateur</DialogTitle>
        <DialogContent>
          Supprimer « {user.username} » ? Cette action est irréversible.
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

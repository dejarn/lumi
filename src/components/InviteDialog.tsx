"use client"

import { useState } from "react"
import type { Role } from "@prisma/client"
import Button from "@mui/material/Button"
import Dialog from "@mui/material/Dialog"
import DialogTitle from "@mui/material/DialogTitle"
import DialogContent from "@mui/material/DialogContent"
import DialogActions from "@mui/material/DialogActions"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import Select from "@mui/material/Select"
import MenuItem from "@mui/material/MenuItem"
import TextField from "@mui/material/TextField"
import Typography from "@mui/material/Typography"
import Box from "@mui/material/Box"
import Alert from "@mui/material/Alert"

type InviteResult = {
  token: string
  role: Role
}

export default function InviteDialog() {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<Role>("USER")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<InviteResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    setOpen(false)
    setResult(null)
    setCopied(false)
    setError(null)
    setRole("USER")
  }

  async function handleCreate() {
    setLoading(true)
    setError(null)
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    })
    setLoading(false)

    if (!res.ok) {
      setError("Impossible de créer l'invitation.")
      return
    }

    const data = (await res.json()) as InviteResult
    setResult(data)
  }

  const inviteUrl =
    typeof window !== "undefined" && result
      ? `${window.location.origin}/invite/${result.token}`
      : result
        ? `/invite/${result.token}`
        : ""

  async function handleCopy() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
  }

  return (
    <>
      <Button variant="contained" onClick={() => setOpen(true)}>
        Inviter
      </Button>

      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
        <DialogTitle>{result ? "Invitation créée" : "Nouvelle invitation"}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {result ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Ce lien ne sera affiché qu&apos;une seule fois. Copiez-le maintenant.
              </Typography>
              <TextField
                label="Lien d'invitation"
                value={inviteUrl}
                fullWidth
                slotProps={{ input: { readOnly: true } }}
              />
              {copied && (
                <Alert severity="success">Lien copié dans le presse-papiers.</Alert>
              )}
            </Box>
          ) : (
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel>Rôle</InputLabel>
              <Select label="Rôle" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <MenuItem value="USER">USER</MenuItem>
                <MenuItem value="ADMIN">ADMIN</MenuItem>
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>{result ? "Fermer" : "Annuler"}</Button>
          {result ? (
            <Button variant="contained" onClick={handleCopy}>
              Copier le lien
            </Button>
          ) : (
            <Button variant="contained" onClick={handleCreate} disabled={loading}>
              Créer
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  )
}

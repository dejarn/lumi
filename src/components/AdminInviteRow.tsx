"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { Role } from "@prisma/client"
import ListItem from "@mui/material/ListItem"
import ListItemText from "@mui/material/ListItemText"
import IconButton from "@mui/material/IconButton"
import DeleteIcon from "@mui/icons-material/Delete"

type InviteRow = {
  id: string
  role: Role
  expiresAt: string | Date
  usedAt: string | Date | null
  createdAt: string | Date
}

export default function AdminInviteRow({ invite }: { invite: InviteRow }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const expiresAt = new Date(invite.expiresAt)

  async function handleRevoke() {
    setLoading(true)
    const res = await fetch(`/api/invites/${invite.id}`, { method: "DELETE" })
    setLoading(false)
    if (res.ok) router.refresh()
  }

  const status = invite.usedAt
    ? "utilisée"
    : expiresAt < new Date()
      ? "expirée"
      : "en attente"

  return (
    <ListItem
      divider
      secondaryAction={
        !invite.usedAt && (
          <IconButton aria-label="Révoquer" onClick={handleRevoke} disabled={loading}>
            <DeleteIcon />
          </IconButton>
        )
      }
    >
      <ListItemText
        primary={`Invitation · ${invite.role}`}
        secondary={`${status} · expire le ${expiresAt.toLocaleDateString("fr-FR")}`}
      />
    </ListItem>
  )
}

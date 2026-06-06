"use client"

import { use, useState } from "react"
import Card from "@mui/material/Card"
import CardContent from "@mui/material/CardContent"
import TextField from "@mui/material/TextField"
import Button from "@mui/material/Button"
import Typography from "@mui/material/Typography"
import Box from "@mui/material/Box"

// Token is validated against GET /api/invites/[token] before showing the form,
// then submitted via POST /api/invites/[token]/accept (docs/api.md#invites).
export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    // TODO: POST /api/invites/[token]/accept, then sign in + redirect to /dashboard.
    await fetch(`/api/invites/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
  }

  return (
    <Card>
      <CardContent component="form" onSubmit={onSubmit}>
        <Typography variant="h4" gutterBottom>
          Créer un compte
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="Identifiant"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <TextField
            label="Mot de passe"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" variant="contained">
            Rejoindre
          </Button>
        </Box>
      </CardContent>
    </Card>
  )
}

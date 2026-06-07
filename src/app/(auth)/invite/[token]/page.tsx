"use client"

import { use, useEffect, useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import type { Role } from "@prisma/client"
import Card from "@mui/material/Card"
import CardContent from "@mui/material/CardContent"
import TextField from "@mui/material/TextField"
import Button from "@mui/material/Button"
import Typography from "@mui/material/Typography"
import Alert from "@mui/material/Alert"
import Box from "@mui/material/Box"
import CircularProgress from "@mui/material/CircularProgress"

type InviteStatus = "loading" | "valid" | "not_found" | "expired"

// Token is validated against GET /api/invites/[token] before showing the form,
// then submitted via POST /api/invites/[token]/accept (docs/api.md#invites).
export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()
  const [status, setStatus] = useState<InviteStatus>("loading")
  const [role, setRole] = useState<Role | null>(null)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function validate() {
      const res = await fetch(`/api/invites/${token}`)
      if (cancelled) return

      if (res.status === 404) {
        setStatus("not_found")
        return
      }
      if (res.status === 410) {
        setStatus("expired")
        return
      }
      if (!res.ok) {
        setStatus("not_found")
        return
      }

      const data = (await res.json()) as { role: Role }
      setRole(data.role)
      setStatus("valid")
    }

    void validate()
    return () => {
      cancelled = true
    }
  }, [token])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await fetch(`/api/invites/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })

    if (res.status === 409) {
      setLoading(false)
      setError("Cet identifiant est déjà pris.")
      return
    }
    if (res.status === 400) {
      const data = (await res.json()) as { error?: string }
      setLoading(false)
      setError(data.error ?? "Mot de passe trop faible (8 caractères minimum).")
      return
    }
    if (res.status === 410) {
      setLoading(false)
      setStatus("expired")
      return
    }
    if (!res.ok) {
      setLoading(false)
      setError("Une erreur est survenue.")
      return
    }

    const signInRes = await signIn("credentials", { username, password, redirect: false })
    setLoading(false)

    if (signInRes?.error) {
      setError("Compte créé, mais la connexion a échoué. Essayez de vous connecter.")
      return
    }

    router.push("/dashboard")
  }

  if (status === "loading") {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (status === "not_found") {
    return (
      <Card>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            Invitation introuvable
          </Typography>
          <Typography color="text.secondary">
            Ce lien d&apos;invitation n&apos;existe pas ou n&apos;est plus valide.
          </Typography>
        </CardContent>
      </Card>
    )
  }

  if (status === "expired") {
    return (
      <Card>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            Invitation expirée
          </Typography>
          <Typography color="text.secondary">
            Cette invitation a expiré ou a déjà été utilisée. Demandez une nouvelle invitation.
          </Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent component="form" onSubmit={onSubmit}>
        <Typography variant="h4" gutterBottom>
          Créer un compte
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Rôle attribué : {role}
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="Identifiant"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
          <TextField
            label="Mot de passe"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          <Button type="submit" variant="contained" disabled={loading}>
            Rejoindre
          </Button>
        </Box>
      </CardContent>
    </Card>
  )
}

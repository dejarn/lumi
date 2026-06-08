"use client"

import { Suspense, useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Card from "@mui/material/Card"
import CardContent from "@mui/material/CardContent"
import TextField from "@mui/material/TextField"
import Button from "@mui/material/Button"
import Typography from "@mui/material/Typography"
import Alert from "@mui/material/Alert"
import Box from "@mui/material/Box"
import CircularProgress from "@mui/material/CircularProgress"

function safeCallbackUrl(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw
  return "/dashboard"
}

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await signIn("credentials", { username, password, redirect: false })
    setLoading(false)
    if (res?.error) {
      setError("Identifiants invalides.")
      return
    }
    router.push(safeCallbackUrl(params.get("callbackUrl")))
  }

  return (
    <Card>
      <CardContent component="form" onSubmit={onSubmit}>
        <Typography variant="h4" gutterBottom>
          Lumi
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
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
            autoComplete="current-password"
            required
          />
          <Button type="submit" variant="contained" disabled={loading}>
            Se connecter
          </Button>
        </Box>
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<CircularProgress />}>
      <LoginForm />
    </Suspense>
  )
}

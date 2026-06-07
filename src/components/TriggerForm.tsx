"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { TriggerType } from "@prisma/client"
import Box from "@mui/material/Box"
import TextField from "@mui/material/TextField"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import Select from "@mui/material/Select"
import MenuItem from "@mui/material/MenuItem"
import ToggleButton from "@mui/material/ToggleButton"
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup"
import Button from "@mui/material/Button"
import Alert from "@mui/material/Alert"

const CRON_EXPR_PATTERN = /^(\S+\s+){4}\S+$/

type TriggerFormProps = {
  scenes: { id: string; name: string }[]
  sensorDevices: { id: string; name: string }[]
}

// Discriminated create form (ADMIN): CRON (cronExpr + scene) or SENSOR
// (sensor device + state + scene). See docs/api.md#triggers.
export default function TriggerForm({ scenes, sensorDevices }: TriggerFormProps) {
  const router = useRouter()
  const [type, setType] = useState<TriggerType>("CRON")
  const [name, setName] = useState("")
  const [sceneId, setSceneId] = useState("")
  const [cronExpr, setCronExpr] = useState("")
  const [sensorDeviceId, setSensorDeviceId] = useState("")
  const [sensorState, setSensorState] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Le nom est requis.")
      return
    }
    if (!sceneId) {
      setError("La scène est requise.")
      return
    }

    if (type === "CRON") {
      const trimmed = cronExpr.trim()
      if (!trimmed || !CRON_EXPR_PATTERN.test(trimmed)) {
        setError("Expression cron invalide (5 champs requis, ex. 0 7 * * 1-5).")
        return
      }
    } else if (!sensorDeviceId) {
      setError("Le capteur est requis.")
      return
    }

    setSubmitting(true)
    const body =
      type === "CRON"
        ? { type: "CRON" as const, name: trimmedName, sceneId, cronExpr: cronExpr.trim() }
        : { type: "SENSOR" as const, name: trimmedName, sceneId, sensorDeviceId, sensorState }

    const res = await fetch("/api/triggers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    setSubmitting(false)

    if (res.status === 422) {
      const data = (await res.json()) as { error?: string }
      setError(data.error ?? "Requête invalide.")
      return
    }

    if (!res.ok) {
      setError("Une erreur est survenue.")
      return
    }

    setName("")
    setSceneId("")
    setCronExpr("")
    setSensorDeviceId("")
    setSensorState(true)
    router.refresh()
  }

  return (
    <Box
      component="form"
      onSubmit={onSubmit}
      sx={{ display: "flex", flexDirection: "column", gap: 2 }}
    >
      {error && <Alert severity="error">{error}</Alert>}

      <ToggleButtonGroup
        exclusive
        value={type}
        onChange={(_, v) => v && setType(v as TriggerType)}
        size="small"
      >
        <ToggleButton value="CRON">Horaire</ToggleButton>
        <ToggleButton value="SENSOR">Capteur</ToggleButton>
      </ToggleButtonGroup>

      <TextField
        label="Nom"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        fullWidth
      />

      <FormControl required fullWidth>
        <InputLabel>Scène</InputLabel>
        <Select label="Scène" value={sceneId} onChange={(e) => setSceneId(e.target.value)}>
          {scenes.map((scene) => (
            <MenuItem key={scene.id} value={scene.id}>
              {scene.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {type === "CRON" ? (
        <TextField
          label="Expression cron"
          placeholder="0 7 * * 1-5"
          value={cronExpr}
          onChange={(e) => setCronExpr(e.target.value)}
          required
          fullWidth
        />
      ) : (
        <>
          <FormControl required fullWidth>
            <InputLabel>Capteur</InputLabel>
            <Select
              label="Capteur"
              value={sensorDeviceId}
              onChange={(e) => setSensorDeviceId(e.target.value)}
            >
              {sensorDevices.map((device) => (
                <MenuItem key={device.id} value={device.id}>
                  {device.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <ToggleButtonGroup
            exclusive
            value={sensorState}
            onChange={(_, v) => v !== null && setSensorState(v)}
            size="small"
          >
            <ToggleButton value={true}>Actif</ToggleButton>
            <ToggleButton value={false}>Inactif</ToggleButton>
          </ToggleButtonGroup>
        </>
      )}

      <Button type="submit" variant="contained" disabled={submitting}>
        Créer
      </Button>
    </Box>
  )
}

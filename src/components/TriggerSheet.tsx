"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { Trigger, Scene, TriggerType } from "@prisma/client"
import Drawer from "@mui/material/Drawer"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import TextField from "@mui/material/TextField"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import Select from "@mui/material/Select"
import MenuItem from "@mui/material/MenuItem"
import ToggleButton from "@mui/material/ToggleButton"
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup"
import Button from "@mui/material/Button"
import Alert from "@mui/material/Alert"
import {
  buildCron,
  parseCron,
  cronToHuman,
  type CronDays,
} from "@/lib/automation/cron-human"
import { glowStyle } from "@/lib/tokens"

type TriggerWithScene = Trigger & { scene: Scene }

type DayPreset = "tous" | "weekdays" | "weekend" | "custom"

const WEEKDAYS: number[] = [1, 2, 3, 4, 5]
const WEEKEND: number[] = [0, 6]

const CHIP_DAYS: { label: string; value: number }[] = [
  { label: "Lun", value: 1 },
  { label: "Mar", value: 2 },
  { label: "Mer", value: 3 },
  { label: "Jeu", value: 4 },
  { label: "Ven", value: 5 },
  { label: "Sam", value: 6 },
  { label: "Dim", value: 0 },
]

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)

function sortedUnique(days: number[]): number[] {
  return [...new Set(days)].sort((a, b) => a - b)
}

function arraysEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

function detectPreset(days: CronDays): DayPreset {
  if (days === "all") return "tous"
  const sorted = sortedUnique(days)
  if (arraysEqual(sorted, WEEKDAYS)) return "weekdays"
  if (arraysEqual(sorted, WEEKEND)) return "weekend"
  return "custom"
}

function presetToDays(preset: DayPreset): CronDays {
  switch (preset) {
    case "tous":
      return "all"
    case "weekdays":
      return [...WEEKDAYS]
    case "weekend":
      return [...WEEKEND]
    case "custom":
      return []
  }
}

function snapMinute(m: number): number {
  return Math.min(55, Math.round(m / 5) * 5)
}

function initCronState(trigger: TriggerWithScene | undefined): {
  hour: number
  minute: number
  days: CronDays
  preset: DayPreset
  advancedCronWarning: boolean
} {
  if (!trigger || trigger.type !== "CRON") {
    return { hour: 7, minute: 0, days: "all", preset: "tous", advancedCronWarning: false }
  }

  const parsed = trigger.cronExpr ? parseCron(trigger.cronExpr) : null
  if (parsed) {
    return {
      hour: parsed.hour,
      minute: snapMinute(parsed.minute),
      days: parsed.days,
      preset: detectPreset(parsed.days),
      advancedCronWarning: false,
    }
  }

  return { hour: 7, minute: 0, days: "all", preset: "tous", advancedCronWarning: true }
}

function TriggerSheetForm({
  trigger,
  scenes,
  sensorDevices,
  onClose,
}: {
  trigger?: TriggerWithScene
  scenes: { id: string; name: string }[]
  sensorDevices: { id: string; name: string }[]
  onClose: () => void
}) {
  const router = useRouter()
  const isEdit = trigger !== undefined
  const cronInit = initCronState(trigger)

  const [type, setType] = useState<TriggerType>(() => trigger?.type ?? "CRON")
  const [name, setName] = useState(() => trigger?.name ?? "")
  const [sceneId, setSceneId] = useState(() => trigger?.sceneId ?? "")
  const [hour, setHour] = useState(cronInit.hour)
  const [minute, setMinute] = useState(cronInit.minute)
  const [days, setDays] = useState<CronDays>(cronInit.days)
  const [preset, setPreset] = useState<DayPreset>(cronInit.preset)
  const [sensorDeviceId, setSensorDeviceId] = useState(() => trigger?.sensorDeviceId ?? "")
  const [sensorState, setSensorState] = useState(() => trigger?.sensorState ?? true)
  const [advancedCronWarning] = useState(cronInit.advancedCronWarning)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const cronPreview = useMemo(() => {
    if (type !== "CRON") return null
    if (days !== "all" && Array.isArray(days) && days.length === 0) return null
    try {
      return cronToHuman(buildCron({ hour, minute, days }))
    } catch {
      return null
    }
  }, [type, hour, minute, days])

  const noDaysSelected = type === "CRON" && days !== "all" && Array.isArray(days) && days.length === 0

  function onPresetChange(next: DayPreset) {
    setPreset(next)
    setDays(presetToDays(next))
  }

  function onChipToggle(day: number) {
    const current = days === "all" ? [] : [...days]
    const idx = current.indexOf(day)
    if (idx >= 0) {
      current.splice(idx, 1)
    } else {
      current.push(day)
    }
    setDays(sortedUnique(current))
    setPreset("custom")
  }

  function chipSelected(day: number): boolean {
    if (days === "all") return false
    return days.includes(day)
  }

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
      if (noDaysSelected) {
        setError("Sélectionnez au moins un jour.")
        return
      }
    } else if (!sensorDeviceId) {
      setError("Le capteur est requis.")
      return
    }

    setSubmitting(true)

    let res: Response
    if (isEdit && trigger) {
      const body =
        type === "CRON"
          ? { name: trimmedName, cronExpr: buildCron({ hour, minute, days }) }
          : { name: trimmedName, sensorDeviceId, sensorState }
      res = await fetch(`/api/triggers/${trigger.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    } else {
      const body =
        type === "CRON"
          ? {
              type: "CRON" as const,
              name: trimmedName,
              sceneId,
              cronExpr: buildCron({ hour, minute, days }),
            }
          : {
              type: "SENSOR" as const,
              name: trimmedName,
              sceneId,
              sensorDeviceId,
              sensorState,
            }
      res = await fetch("/api/triggers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    }

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

    router.refresh()
    onClose()
  }

  const selectedGlow = glowStyle.accent

  return (
    <Box component="form" onSubmit={onSubmit} sx={{ p: 2, pb: 4 }}>
      <Box
        sx={{
          width: 32,
          height: 4,
          borderRadius: 2,
          backgroundColor: "var(--lumi-glass-border)",
          mx: "auto",
          mb: 1.5,
        }}
      />
      <Typography variant="h6" gutterBottom>
        {isEdit ? trigger.name : "Nouveau déclencheur"}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {!isEdit && (
          <ToggleButtonGroup
            exclusive
            value={type}
            onChange={(_, v) => v && setType(v as TriggerType)}
            size="small"
            fullWidth
          >
            <ToggleButton value="CRON">Horaire</ToggleButton>
            <ToggleButton value="SENSOR">Capteur</ToggleButton>
          </ToggleButtonGroup>
        )}

        <TextField
          label="Nom"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          fullWidth
        />

        <FormControl required fullWidth disabled={isEdit}>
          <InputLabel>Scène</InputLabel>
          <Select label="Scène" value={sceneId} onChange={(e) => setSceneId(e.target.value)}>
            {scenes.length === 0 ? (
              <MenuItem disabled value="">
                Aucune scène
              </MenuItem>
            ) : (
              scenes.map((scene) => (
                <MenuItem key={scene.id} value={scene.id}>
                  {scene.name}
                </MenuItem>
              ))
            )}
          </Select>
        </FormControl>

        {type === "CRON" ? (
          <>
            {advancedCronWarning && (
              <Alert severity="warning">
                Cet horaire avancé sera remplacé si vous enregistrez.
              </Alert>
            )}

            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Heure
              </Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel id="trigger-hour-label">Heure</InputLabel>
                  <Select
                    labelId="trigger-hour-label"
                    label="Heure"
                    value={hour}
                    onChange={(e) => setHour(Number(e.target.value))}
                  >
                    {HOURS.map((h) => (
                      <MenuItem key={h} value={h}>
                        {h.toString().padStart(2, "0")}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel id="trigger-minute-label">Minute</InputLabel>
                  <Select
                    labelId="trigger-minute-label"
                    label="Minute"
                    value={minute}
                    onChange={(e) => setMinute(Number(e.target.value))}
                  >
                    {MINUTES.map((m) => (
                      <MenuItem key={m} value={m}>
                        {m.toString().padStart(2, "0")}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Jours
              </Typography>
              <ToggleButtonGroup
                exclusive
                value={preset}
                onChange={(_, v) => v && onPresetChange(v as DayPreset)}
                size="small"
                fullWidth
                sx={{ mb: preset === "custom" ? 1 : 0 }}
              >
                <ToggleButton value="tous">Tous</ToggleButton>
                <ToggleButton value="weekdays">Lun–Ven</ToggleButton>
                <ToggleButton value="weekend">Week-end</ToggleButton>
                <ToggleButton value="custom">Perso</ToggleButton>
              </ToggleButtonGroup>

              {preset === "custom" && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {CHIP_DAYS.map(({ label, value }) => (
                    <ToggleButton
                      key={value}
                      value={value}
                      selected={chipSelected(value)}
                      onClick={() => onChipToggle(value)}
                      size="small"
                      sx={{
                        borderColor: "divider",
                        "&.Mui-selected": selectedGlow,
                      }}
                    >
                      {label}
                    </ToggleButton>
                  ))}
                </Box>
              )}
            </Box>

            {cronPreview && (
              <Typography variant="body2" color="text.secondary">
                {cronPreview}
              </Typography>
            )}

            {noDaysSelected && (
              <Typography variant="caption" color="error">
                Sélectionnez au moins un jour.
              </Typography>
            )}
          </>
        ) : (
          <>
            <FormControl required fullWidth>
              <InputLabel>Capteur</InputLabel>
              <Select
                label="Capteur"
                value={sensorDeviceId}
                onChange={(e) => setSensorDeviceId(e.target.value)}
              >
                {sensorDevices.length === 0 ? (
                  <MenuItem disabled value="">
                    Aucun capteur
                  </MenuItem>
                ) : (
                  sensorDevices.map((device) => (
                    <MenuItem key={device.id} value={device.id}>
                      {device.name}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 1 }}
              >
                État du capteur
              </Typography>
              <ToggleButtonGroup
                exclusive
                value={sensorState}
                onChange={(_, v) => v !== null && setSensorState(v)}
                size="small"
              >
                <ToggleButton value={true}>Actif</ToggleButton>
                <ToggleButton value={false}>Inactif</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </>
        )}

        <Button type="submit" variant="contained" disabled={submitting || noDaysSelected}>
          {isEdit ? "Enregistrer" : "Créer"}
        </Button>
      </Box>
    </Box>
  )
}

export default function TriggerSheet({
  open,
  onClose,
  trigger,
  scenes,
  sensorDevices,
}: {
  open: boolean
  onClose: () => void
  trigger?: TriggerWithScene
  scenes: { id: string; name: string }[]
  sensorDevices: { id: string; name: string }[]
}) {
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            borderTopLeftRadius: "var(--lumi-radius-md)",
            borderTopRightRadius: "var(--lumi-radius-md)",
            borderTop: "1px solid",
            borderColor: "primary.main",
            backgroundColor: "var(--lumi-glass-bg)",
            backdropFilter: "var(--lumi-glass-blur)",
            WebkitBackdropFilter: "var(--lumi-glass-blur)",
            backgroundImage: "none",
            maxHeight: "85vh",
            overflowY: "auto",
          },
        },
        backdrop: {
          sx: { backgroundColor: "var(--lumi-scrim)", backdropFilter: "blur(6px)" },
        },
      }}
    >
      {open && (
        <TriggerSheetForm
          key={trigger?.id ?? "create"}
          trigger={trigger}
          scenes={scenes}
          sensorDevices={sensorDevices}
          onClose={onClose}
        />
      )}
    </Drawer>
  )
}

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Drawer from "@mui/material/Drawer"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Button from "@mui/material/Button"
import Alert from "@mui/material/Alert"
import CircularProgress from "@mui/material/CircularProgress"
import Dialog from "@mui/material/Dialog"
import DialogTitle from "@mui/material/DialogTitle"
import DialogContent from "@mui/material/DialogContent"
import DialogActions from "@mui/material/DialogActions"
import TextField from "@mui/material/TextField"
import Divider from "@mui/material/Divider"
import Checkbox from "@mui/material/Checkbox"
import FormControlLabel from "@mui/material/FormControlLabel"
import { averageColor, tileTint } from "@/lib/color"
import { lightStateLabel } from "@/lib/device-state-label"
import { useDeviceState } from "@/components/SseProvider"

type SceneDeviceCurrent = {
  power: boolean | null
  brightness: number | null
  hue: number | null
  saturation: number | null
  colorBrightness: number | null
  animId: number | null
  animSpeed: number | null
  animIntensity: number | null
}

type SceneDeviceDetail = {
  deviceId: string
  power: boolean
  brightness: number
  hue: number
  saturation: number
  colorBrightness: number
  animId: number
  name: string
  reachable: boolean
  kind: string
  current: SceneDeviceCurrent
}

type SceneDetail = {
  id: string
  name: string
  devices: SceneDeviceDetail[]
}

type LightDevice = {
  id: string
  name: string
  kind: string
  reachable: boolean
  power: boolean | null
  brightness: number | null
  hue: number | null
  saturation: number | null
  colorBrightness: number | null
  animId: number | null
}

type SheetMode = "view" | "edit"

function ambientRgba(hex: string): string {
  if (!hex.startsWith("#") || hex.length < 7) return "rgba(255,150,60,0.10)"
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},0.10)`
}

function sceneDeviceStateLabel(device: SceneDeviceDetail): string {
  return lightStateLabel({
    reachable: device.reachable,
    power: device.power,
    brightness: device.brightness,
    animId: device.animId,
  })
}

function DeviceRow({ device }: { device: SceneDeviceDetail }) {
  const tint =
    device.kind !== "SENSOR" && device.power && device.reachable
      ? tileTint(device.hue)
      : undefined

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        py: 1,
        opacity: device.reachable ? 1 : 0.4,
        filter: device.reachable ? "none" : "grayscale(0.6)",
      }}
    >
      <Box
        sx={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          flexShrink: 0,
          backgroundColor: tint ?? "rgba(255,255,255,0.12)",
          border: "1px solid",
          borderColor: tint ?? "rgba(255,255,255,0.18)",
        }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
          {device.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {sceneDeviceStateLabel(device)}
        </Typography>
      </Box>
    </Box>
  )
}

function CaptureRow({
  device,
  selected,
  onToggle,
}: {
  device: LightDevice
  selected: boolean
  onToggle: () => void
}) {
  const live = useDeviceState(device.id)
  const reachable = live?.reachable ?? device.reachable
  const power = live?.power ?? device.power ?? false
  const brightness = live?.brightness ?? device.brightness ?? 0
  const hue = live?.hue ?? device.hue ?? 0
  const animId = live?.animId ?? device.animId ?? 0

  const tint = power && reachable ? tileTint(hue) : undefined
  const label = lightStateLabel({ reachable, power, brightness, animId })

  return (
    <Box
      component="label"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        py: 1,
        px: 0.5,
        mx: -0.5,
        borderRadius: 1,
        cursor: "pointer",
        opacity: reachable ? 1 : 0.4,
        filter: reachable ? "none" : "grayscale(0.6)",
        "&:hover": { backgroundColor: "rgba(255,255,255,0.04)" },
      }}
    >
      <Checkbox
        checked={selected}
        onChange={onToggle}
        slotProps={{ input: { "aria-label": selected ? "Désélectionner" : "Sélectionner" } }}
        sx={{ p: 0.5 }}
      />
      <Box
        sx={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          flexShrink: 0,
          backgroundColor: tint ?? "rgba(255,255,255,0.12)",
          border: "1px solid",
          borderColor: tint ?? "rgba(255,255,255,0.18)",
        }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
          {device.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {label}
        </Typography>
      </Box>
    </Box>
  )
}

function SceneSheetContent({
  sceneId,
  sceneName,
  onClose,
  isAdmin,
  startInEditMode,
}: {
  sceneId: string
  sceneName: string
  onClose: () => void
  isAdmin: boolean
  startInEditMode?: boolean
}) {
  const router = useRouter()
  const [mode, setMode] = useState<SheetMode>(startInEditMode && isAdmin ? "edit" : "view")
  const [detail, setDetail] = useState<SceneDetail | null>(null)
  const [lights, setLights] = useState<LightDevice[]>([])
  const [lightsLoading, setLightsLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activating, setActivating] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState(sceneName)
  const [busy, setBusy] = useState(false)
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reloadDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/scenes/${sceneId}`)
      if (!res.ok) {
        setError(res.status === 404 ? "Scène introuvable." : "Impossible de charger la scène.")
        setDetail(null)
        return null
      }
      const data = (await res.json()) as SceneDetail
      setDetail(data)
      setName(data.name)
      setError(null)
      return data
    } catch {
      setError("Impossible de charger la scène.")
      setDetail(null)
      return null
    }
  }, [sceneId])

  const loadLights = useCallback(async () => {
    setLightsLoading(true)
    try {
      const res = await fetch("/api/devices")
      if (!res.ok) {
        setError("Impossible de charger les lumières.")
        return
      }
      const data = (await res.json()) as LightDevice[]
      setLights(data.filter((d) => d.kind === "LIGHT"))
    } catch {
      setError("Impossible de charger les lumières.")
    } finally {
      setLightsLoading(false)
    }
  }, [])

  const enterEditMode = useCallback(async () => {
    setError(null)
    const data = detail ?? (await reloadDetail())
    setSelectedIds(new Set(data?.devices.map((d) => d.deviceId) ?? []))
    setMode("edit")
    await loadLights()
  }, [detail, reloadDetail, loadLights])

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/scenes/${sceneId}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
          setError(
            res.status === 404 ? "Scène introuvable." : "Impossible de charger la scène.",
          )
          setDetail(null)
          return null
        }
        return res.json() as Promise<SceneDetail>
      })
      .then((data) => {
        if (!data) return
        setDetail(data)
        setName(data.name)
        if (startInEditMode && isAdmin) {
          setSelectedIds(new Set(data.devices.map((d) => d.deviceId)))
          void loadLights()
        }
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return
        setError("Impossible de charger la scène.")
        setDetail(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [sceneId, startInEditMode, isAdmin, loadLights])

  useEffect(() => {
    return () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
    }
  }, [])

  const lightIds = lights.map((d) => d.id)
  const allSelected = lightIds.length > 0 && lightIds.every((id) => selectedIds.has(id))

  function toggleSelect(deviceId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(deviceId)) next.delete(deviceId)
      else next.add(deviceId)
      return next
    })
  }

  function handleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(lightIds) : new Set())
  }

  function cancelEdit() {
    setError(null)
    setMode("view")
  }

  async function handleActivate() {
    if (!detail) return
    setActivating(true)
    setError(null)
    const avg = averageColor(
      detail.devices.map((d) => ({
        power: d.power,
        hue: d.hue,
        saturation: d.saturation,
        colorBrightness: d.colorBrightness,
      })),
    )
    try {
      const res = await fetch(`/api/scenes/${sceneId}/activate`, { method: "POST" })
      if (res.status === 202) {
        document.documentElement.style.setProperty("--lumi-ambient", ambientRgba(avg))
        if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
        pulseTimerRef.current = setTimeout(() => {
          document.documentElement.style.removeProperty("--lumi-ambient")
        }, 800)
        onClose()
      } else {
        setError("L'activation a échoué.")
      }
    } catch {
      setError("L'activation a échoué.")
    } finally {
      setActivating(false)
    }
  }

  async function handleValidateSelection() {
    setCapturing(true)
    setError(null)
    try {
      const res = await fetch(`/api/scenes/${sceneId}/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceIds: [...selectedIds] }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError((data as { error?: string } | null)?.error ?? "L'enregistrement a échoué.")
        return
      }
      await reloadDetail()
      setMode("view")
      router.refresh()
    } catch {
      setError("L'enregistrement a échoué.")
    } finally {
      setCapturing(false)
    }
  }

  async function handleRename() {
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/scenes/${sceneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError((data as { error?: string } | null)?.error ?? "Le renommage a échoué.")
        return
      }
      setRenameOpen(false)
      setDetail((prev) => (prev ? { ...prev, name: trimmed } : prev))
      router.refresh()
    } catch {
      setError("Le renommage a échoué.")
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/scenes/${sceneId}`, { method: "DELETE" })
      if (!res.ok) {
        setError("La suppression a échoué.")
        return
      }
      setDeleteOpen(false)
      onClose()
      router.refresh()
    } catch {
      setError("La suppression a échoué.")
    } finally {
      setBusy(false)
    }
  }

  const displayName = detail?.name ?? sceneName
  const validateLabel =
    selectedIds.size === 0 ? "Enregistrer (aucune lumière)" : "Valider la sélection"

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Box sx={{ p: 2, pb: mode === "edit" ? 1 : 4, flex: 1, overflowY: "auto" }}>
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
          {mode === "edit" ? "Modifier la scène" : displayName}
        </Typography>
        {mode === "edit" && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Règle les lumières sur le dashboard, puis sélectionne celles à inclure.
          </Typography>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : mode === "edit" ? (
          <>
            {lightsLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress size={32} />
              </Box>
            ) : lights.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                Aucune lumière disponible.
              </Typography>
            ) : (
              <>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={allSelected}
                      indeterminate={selectedIds.size > 0 && !allSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  }
                  label="Tout sélectionner"
                  sx={{ mb: 0.5 }}
                />
                <Box sx={{ mb: 1 }}>
                  {lights.map((device) => (
                    <CaptureRow
                      key={device.id}
                      device={device}
                      selected={selectedIds.has(device.id)}
                      onToggle={() => toggleSelect(device.id)}
                    />
                  ))}
                </Box>
              </>
            )}
          </>
        ) : detail ? (
          <>
            {detail.devices.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                Aucun appareil dans cette scène.
              </Typography>
            ) : (
              <Box sx={{ mb: 2 }}>
                {detail.devices.map((device) => (
                  <DeviceRow key={device.deviceId} device={device} />
                ))}
              </Box>
            )}

            <Divider sx={{ mb: 2 }} />

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Button
                variant="contained"
                onClick={() => void handleActivate()}
                disabled={activating || detail.devices.length === 0}
              >
                Appliquer
              </Button>

              {isAdmin && (
                <>
                  <Button variant="outlined" onClick={() => void enterEditMode()}>
                    Modifier la sélection
                  </Button>
                  <Button
                    variant="text"
                    onClick={() => {
                      setName(displayName)
                      setRenameOpen(true)
                    }}
                  >
                    Renommer
                  </Button>
                  <Button variant="text" color="error" onClick={() => setDeleteOpen(true)}>
                    Supprimer
                  </Button>
                </>
              )}
            </Box>
          </>
        ) : null}
      </Box>

      {mode === "edit" && !loading && (
        <Box
          sx={{
            position: "sticky",
            bottom: 0,
            p: 2,
            pt: 1.5,
            borderTop: "1px solid",
            borderColor: "var(--lumi-glass-border)",
            backgroundColor: "var(--lumi-glass-bg)",
            backdropFilter: "var(--lumi-glass-blur)",
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          <Button
            variant="contained"
            onClick={() => void handleValidateSelection()}
            disabled={capturing || lightsLoading}
          >
            {validateLabel}
          </Button>
          <Button variant="text" onClick={cancelEdit} disabled={capturing}>
            Annuler
          </Button>
        </Box>
      )}

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
        <DialogTitle>Supprimer « {displayName} » ?</DialogTitle>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Annuler</Button>
          <Button color="error" onClick={() => void handleDelete()} disabled={busy}>
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default function SceneSheet({
  sceneId,
  sceneName,
  open,
  onClose,
  isAdmin,
  startInEditMode,
}: {
  sceneId: string
  sceneName: string
  open: boolean
  onClose: () => void
  isAdmin: boolean
  startInEditMode?: boolean
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
            display: "flex",
            flexDirection: "column",
          },
        },
        backdrop: {
          sx: { backgroundColor: "var(--lumi-scrim)", backdropFilter: "blur(6px)" },
        },
      }}
    >
      {open && (
        <SceneSheetContent
          key={`${sceneId}-${startInEditMode ? "edit" : "view"}`}
          sceneId={sceneId}
          sceneName={sceneName}
          onClose={onClose}
          isAdmin={isAdmin}
          startInEditMode={startInEditMode}
        />
      )}
    </Drawer>
  )
}

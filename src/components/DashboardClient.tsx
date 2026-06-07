"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import type { Device } from "@prisma/client"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Alert from "@mui/material/Alert"
import DeviceTile from "@/components/DeviceTile"
import CaptureBar from "@/components/CaptureBar"

type DashboardClientProps = {
  lights: Device[]
  sensors: Device[]
  isAdmin: boolean
  captureSceneId: string | null
}

export default function DashboardClient({
  lights,
  sensors,
  isAdmin,
  captureSceneId,
}: DashboardClientProps) {
  const router = useRouter()
  const [captureMode, setCaptureMode] = useState(Boolean(captureSceneId))
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lightIds = lights.map((d) => d.id)
  const allSelected = lightIds.length > 0 && lightIds.every((id) => selectedIds.has(id))

  const toggleSelect = useCallback((deviceId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(deviceId)) next.delete(deviceId)
      else next.add(deviceId)
      return next
    })
  }, [])

  function handleToggleMode(enabled: boolean) {
    setCaptureMode(enabled)
    setSelectedIds(new Set())
    setError(null)
    if (!enabled) {
      router.push("/dashboard")
    }
  }

  function handleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(lightIds) : new Set())
  }

  async function handleCapture() {
    if (!captureSceneId || selectedIds.size === 0) return
    setCapturing(true)
    setError(null)

    const res = await fetch(`/api/scenes/${captureSceneId}/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceIds: [...selectedIds] }),
    })

    setCapturing(false)

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? "Échec de la capture.")
      return
    }

    setCaptureMode(false)
    setSelectedIds(new Set())
    router.push("/dashboard")
    router.refresh()
  }

  const showCaptureBar = isAdmin && Boolean(captureSceneId)

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {showCaptureBar && (
        <>
          <CaptureBar
            captureMode={captureMode}
            onToggleMode={handleToggleMode}
            selectAll={allSelected}
            onSelectAll={handleSelectAll}
            selectedCount={selectedIds.size}
            onCapture={handleCapture}
            capturing={capturing}
          />
          {error && <Alert severity="error">{error}</Alert>}
        </>
      )}

      <section>
        <Typography variant="h5" gutterBottom>
          Lumières
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1.5 }}>
          {lights.map((device) => (
            <DeviceTile
              key={device.id}
              device={device}
              selectable={showCaptureBar && captureMode}
              selected={selectedIds.has(device.id)}
              onToggleSelect={() => toggleSelect(device.id)}
            />
          ))}
          {lights.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Aucune lumière détectée.
            </Typography>
          )}
        </Box>
      </section>

      <section>
        <Typography variant="h5" gutterBottom>
          Capteurs
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1.5 }}>
          {sensors.map((device) => (
            <DeviceTile key={device.id} device={device} />
          ))}
          {sensors.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Aucun capteur détecté.
            </Typography>
          )}
        </Box>
      </section>
    </Box>
  )
}

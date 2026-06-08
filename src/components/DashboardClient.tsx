"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import type { Device } from "@prisma/client"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Alert from "@mui/material/Alert"
import DeviceTile from "@/components/DeviceTile"
import DeviceControlSheet from "@/components/DeviceControlSheet"
import CaptureBar from "@/components/CaptureBar"
import SkeletonTile from "@/components/ui/SkeletonTile"
import StateCard from "@/components/ui/StateCard"
import OfflineBanner from "@/components/ui/OfflineBanner"
import Toast from "@/components/ui/Toast"
import { useDeviceStates, useSseConnected, useSseError, useSseReconnect } from "@/components/SseProvider"

type DashboardClientProps = {
  lights: Device[]
  sensors: Device[]
  isAdmin: boolean
  captureSceneId: string | null
}

const sectionTitleSx = {
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  fontSize: "0.7rem",
  fontWeight: 600,
  color: "text.secondary",
  mb: 1,
}

const gridSx = { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1.5 }

export default function DashboardClient({
  lights,
  sensors,
  isAdmin,
  captureSceneId,
}: DashboardClientProps) {
  const router = useRouter()
  const connected = useSseConnected()
  const sseError = useSseError()
  const reconnect = useSseReconnect()
  const liveStates = useDeviceStates()
  const [captureMode, setCaptureMode] = useState(Boolean(captureSceneId))
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [lastFailedCommand, setLastFailedCommand] = useState<{
    deviceId: string
    command: Parameters<typeof import("@/lib/device-command").postCommand>[1]
  } | null>(null)
  const [openDeviceId, setOpenDeviceId] = useState<string | null>(null)

  const offlineCount = lights.filter(
    (d) => !(liveStates[d.id]?.reachable ?? d.reachable),
  ).length

  const lightIds = lights.map((d) => d.id)
  const allSelected = lightIds.length > 0 && lightIds.every((id) => selectedIds.has(id))
  const openDevice = lights.find((d) => d.id === openDeviceId) ?? null

  const toggleSelect = useCallback((deviceId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(deviceId)) next.delete(deviceId)
      else next.add(deviceId)
      return next
    })
  }, [])

  const handleCommandError = useCallback(
    (deviceId: string, name: string, command: Parameters<typeof import("@/lib/device-command").postCommand>[1]) => {
      setLastFailedCommand({ deviceId, command })
      setToast(`Échec — ${name} n'a pas répondu`)
    },
    [],
  )

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
  const loading = !connected && !captureMode && !sseError

  if (sseError && !connected) {
    return (
      <StateCard
        icon="⚡"
        title="Connexion temps réel perdue"
        description="Les mises à jour en direct sont indisponibles."
        actionLabel="Réessayer"
        onAction={reconnect}
      />
    )
  }

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

      {!captureMode && <OfflineBanner count={offlineCount} />}

      <Box component="section">
        <Typography sx={sectionTitleSx}>Lumières</Typography>
        <Box sx={gridSx}>
          {loading ? (
            Array.from({ length: Math.max(lights.length, 2) }).map((_, i) => (
              <SkeletonTile key={i} />
            ))
          ) : lights.length > 0 ? (
            lights.map((device) => (
              <DeviceTile
                key={device.id}
                device={device}
                selectable={showCaptureBar && captureMode}
                selected={selectedIds.has(device.id)}
                onToggleSelect={() => toggleSelect(device.id)}
                onOpen={() => setOpenDeviceId(device.id)}
                onCommandError={(cmd) => handleCommandError(device.id, device.name, cmd)}
              />
            ))
          ) : (
            <StateCard icon="💡" title="Aucune lumière" description="Aucune lumière détectée." />
          )}
        </Box>
      </Box>

      <Box component="section">
        <Typography sx={sectionTitleSx}>Capteurs</Typography>
        <Box sx={gridSx}>
          {loading ? (
            <SkeletonTile />
          ) : sensors.length > 0 ? (
            sensors.map((device) => <DeviceTile key={device.id} device={device} />)
          ) : (
            <StateCard icon="◎" title="Aucun capteur" description="Aucun capteur détecté." />
          )}
        </Box>
      </Box>

      {openDevice && (
        <DeviceControlSheet
          device={openDevice}
          open={Boolean(openDeviceId)}
          onClose={() => setOpenDeviceId(null)}
        />
      )}

      <Toast
        open={toast !== null}
        message={toast ?? ""}
        actionLabel={lastFailedCommand ? "Réessayer" : undefined}
        onAction={
          lastFailedCommand
            ? () => {
                void import("@/lib/device-command").then(({ postCommand }) =>
                  postCommand(lastFailedCommand.deviceId, lastFailedCommand.command),
                )
                setToast(null)
              }
            : undefined
        }
        onClose={() => setToast(null)}
      />
    </Box>
  )
}

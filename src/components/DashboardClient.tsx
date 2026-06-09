"use client"

import { useState, useCallback } from "react"
import type { Device } from "@prisma/client"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import DeviceTile from "@/components/DeviceTile"
import DeviceControlSheet from "@/components/DeviceControlSheet"
import SkeletonTile from "@/components/ui/SkeletonTile"
import StateCard from "@/components/ui/StateCard"
import OfflineBanner from "@/components/ui/OfflineBanner"
import Toast from "@/components/ui/Toast"
import { useDeviceStates, useSseConnected, useSseError, useSseReconnect } from "@/components/SseProvider"
import { sectionTitleSx } from "@/lib/ui-sx"

type DashboardClientProps = {
  lights: Device[]
  sensors: Device[]
}

const gridSx = { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1.5 }

export default function DashboardClient({ lights, sensors }: DashboardClientProps) {
  const connected = useSseConnected()
  const sseError = useSseError()
  const reconnect = useSseReconnect()
  const liveStates = useDeviceStates()
  const [toast, setToast] = useState<string | null>(null)
  const [lastFailedCommand, setLastFailedCommand] = useState<{
    deviceId: string
    command: Parameters<typeof import("@/lib/device-command").postCommand>[1]
  } | null>(null)
  const [openDeviceId, setOpenDeviceId] = useState<string | null>(null)

  const offlineCount = lights.filter(
    (d) => !(liveStates[d.id]?.reachable ?? d.reachable),
  ).length

  const openDevice = lights.find((d) => d.id === openDeviceId) ?? null
  const loading = !connected && !sseError

  const handleCommandError = useCallback(
    (deviceId: string, name: string, command: Parameters<typeof import("@/lib/device-command").postCommand>[1]) => {
      setLastFailedCommand({ deviceId, command })
      setToast(`Échec — ${name} n'a pas répondu`)
    },
    [],
  )

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
      <OfflineBanner count={offlineCount} />

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

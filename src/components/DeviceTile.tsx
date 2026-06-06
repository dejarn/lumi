"use client"

import { useState } from "react"
import type { Device } from "@prisma/client"
import Card from "@mui/material/Card"
import CardActionArea from "@mui/material/CardActionArea"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Switch from "@mui/material/Switch"
import Slider from "@mui/material/Slider"
import { useDeviceState } from "@/components/SseProvider"
import DeviceControlSheet from "@/components/DeviceControlSheet"
import type { DeviceCommand } from "@/lib/types"

async function postCommand(deviceId: string, command: DeviceCommand) {
  await fetch(`/api/devices/${deviceId}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  })
}

export default function DeviceTile({ device }: { device: Device }) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const live = useDeviceState(device.id)

  // SSE patch wins over the server-rendered snapshot.
  const power = live?.power ?? device.power ?? false
  const brightness = live?.brightness ?? device.brightness ?? 0
  const reachable = live?.reachable ?? device.reachable
  const animId = live?.animId ?? device.animId ?? 0

  return (
    <>
      <Card
        sx={{
          opacity: reachable ? 1 : 0.45,
          border: "1px solid",
          borderColor: power ? "primary.main" : "divider",
          boxShadow: power ? "inset 0 0 24px rgba(242,180,58,0.12)" : "none",
        }}
      >
        <CardActionArea onClick={() => setSheetOpen(true)} sx={{ p: 1.5 }}>
          <Typography variant="subtitle1" noWrap>
            {device.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {reachable ? (animId > 0 ? `Animation · ${animId}` : "En ligne") : "Hors ligne"}
          </Typography>
        </CardActionArea>

        <Box sx={{ px: 1.5, pb: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
          <Switch
            checked={power}
            disabled={!reachable}
            onChange={(e) => postCommand(device.id, { type: "power", on: e.target.checked })}
          />
          {animId === 0 && (
            <Slider
              size="small"
              min={0}
              max={255}
              value={brightness}
              disabled={!reachable || !power}
              onChangeCommitted={(_, value) =>
                postCommand(device.id, { type: "brightness", brightness: value as number })
              }
            />
          )}
        </Box>
      </Card>

      <DeviceControlSheet device={device} open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  )
}

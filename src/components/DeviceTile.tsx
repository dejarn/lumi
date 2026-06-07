"use client"

import { useState } from "react"
import type { Device } from "@prisma/client"
import Card from "@mui/material/Card"
import CardActionArea from "@mui/material/CardActionArea"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Switch from "@mui/material/Switch"
import Slider from "@mui/material/Slider"
import Checkbox from "@mui/material/Checkbox"
import { useDeviceState } from "@/components/SseProvider"
import DeviceControlSheet from "@/components/DeviceControlSheet"
import { postCommand } from "@/lib/device-command"

type DeviceTileProps = {
  device: Device
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}

export default function DeviceTile({
  device,
  selectable = false,
  selected = false,
  onToggleSelect,
}: DeviceTileProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const live = useDeviceState(device.id)

  // SSE patch wins over the server-rendered snapshot.
  const power = live?.power ?? device.power ?? false
  const brightness = live?.brightness ?? device.brightness ?? 0
  const reachable = live?.reachable ?? device.reachable
  const animId = live?.animId ?? device.animId ?? 0

  const borderColor = selectable && selected ? "primary.main" : power ? "primary.main" : "divider"
  const glow =
    selectable && selected
      ? "inset 0 0 24px rgba(242,180,58,0.28)"
      : power
        ? "inset 0 0 24px rgba(242,180,58,0.12)"
        : "none"

  return (
    <>
      <Card
        sx={{
          position: "relative",
          opacity: reachable ? 1 : 0.45,
          border: "1px solid",
          borderColor,
          boxShadow: glow,
        }}
      >
        {selectable && (
          <Checkbox
            checked={selected}
            onChange={() => onToggleSelect?.()}
            sx={{
              position: "absolute",
              top: 4,
              right: 4,
              zIndex: 2,
              p: 0.5,
            }}
            slotProps={{ input: { "aria-label": "Sélectionner" } }}
          />
        )}
        <CardActionArea
          onClick={() => (selectable ? onToggleSelect?.() : setSheetOpen(true))}
          sx={{ p: 1.5 }}
        >
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

      {!selectable && (
        <DeviceControlSheet device={device} open={sheetOpen} onClose={() => setSheetOpen(false)} />
      )}
    </>
  )
}

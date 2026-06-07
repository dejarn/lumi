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
import { glowForHue } from "@/lib/color"
import { LUMI_EFFECTS } from "@/lib/animations"
import { glowStyle } from "@/lib/tokens"

type DeviceTileProps = {
  device: Device
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: () => void
  onCommandError?: (deviceName: string) => void
}

function effectLabel(animId: number): string {
  return LUMI_EFFECTS.find((e) => e.animId === animId)?.label ?? `#${animId}`
}

export default function DeviceTile({
  device,
  selectable = false,
  selected = false,
  onToggleSelect,
  onCommandError,
}: DeviceTileProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const live = useDeviceState(device.id)

  async function runCommand(command: Parameters<typeof postCommand>[1]) {
    const ok = await postCommand(device.id, command)
    if (!ok) onCommandError?.(device.name)
  }

  // SSE patch wins over the server-rendered snapshot.
  const reachable = live?.reachable ?? device.reachable
  const isSensor = device.kind === "SENSOR"

  const power = live?.power ?? device.power ?? false
  const brightness = live?.brightness ?? device.brightness ?? 0
  const hue = live?.hue ?? device.hue ?? 0
  const animId = live?.animId ?? device.animId ?? 0
  const sensorActive = live?.sensorActive ?? device.sensorActive ?? false

  const animating = !isSensor && animId > 0
  const brightnessPct = Math.round((brightness / 255) * 100)

  // Border = state (docs/design.md). Selection wins, then live device state.
  const glow: keyof typeof glowStyle =
    selectable && selected
      ? "accent"
      : isSensor
        ? sensorActive
          ? "sensor"
          : "none"
        : power
          ? glowForHue(hue)
          : "none"

  const glowSx = glowStyle[glow]

  const stateLabel = !reachable
    ? "Hors ligne"
    : isSensor
      ? sensorActive
        ? "Actif"
        : "Inactif"
      : animating
        ? `Animation · ${effectLabel(animId)}`
        : power
          ? `ON · ${brightnessPct}%`
          : "Éteint"

  return (
    <>
      <Card
        sx={{
          position: "relative",
          opacity: reachable ? 1 : 0.4,
          filter: reachable ? "none" : "grayscale(0.6)",
          borderColor: glowSx.borderColor,
          boxShadow: glowSx.boxShadow,
          ...(animating && { animation: "border-rainbow 4s linear infinite" }),
        }}
      >
        {selectable && (
          <Checkbox
            checked={selected}
            onChange={() => onToggleSelect?.()}
            sx={{ position: "absolute", top: 4, right: 4, zIndex: 2, p: 0.5 }}
            slotProps={{ input: { "aria-label": "Sélectionner" } }}
          />
        )}
        <CardActionArea
          onClick={() =>
            selectable ? onToggleSelect?.() : isSensor ? undefined : setSheetOpen(true)
          }
          disabled={!selectable && isSensor}
          sx={{ p: 1.5, minHeight: 72, display: "flex", flexDirection: "column", alignItems: "stretch" }}
        >
          <Typography variant="subtitle1" noWrap sx={{ fontWeight: 600 }}>
            {device.name}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: animating ? "primary.main" : "text.secondary", fontWeight: animating ? 500 : 400 }}
          >
            {stateLabel}
          </Typography>
          {animating && (
            <Box
              sx={{
                height: 8,
                borderRadius: 1,
                mt: 1,
                background:
                  "linear-gradient(90deg, #ff6050, #ffb050, #50ff90, #50a0ff, #ff6050)",
                backgroundSize: "200% 100%",
                animation: "wave-scroll 2.5s linear infinite",
              }}
            />
          )}
        </CardActionArea>

        {!isSensor && (
          <Box sx={{ px: 1.5, pb: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
            <Switch
              checked={power}
              disabled={!reachable}
              onChange={(e) => void runCommand({ type: "power", on: e.target.checked })}
            />
            {!animating && (
              <Slider
                size="small"
                min={0}
                max={255}
                value={brightness}
                disabled={!reachable || !power}
                onChangeCommitted={(_, value) =>
                  void runCommand({ type: "brightness", brightness: value as number })
                }
              />
            )}
          </Box>
        )}
      </Card>

      {!selectable && !isSensor && (
        <DeviceControlSheet device={device} open={sheetOpen} onClose={() => setSheetOpen(false)} />
      )}
    </>
  )
}

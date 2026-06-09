"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Device } from "@prisma/client"
import { HsvColorPicker } from "react-colorful"
import Drawer from "@mui/material/Drawer"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Tabs from "@mui/material/Tabs"
import Tab from "@mui/material/Tab"
import Slider from "@mui/material/Slider"
import Button from "@mui/material/Button"
import ToggleButton from "@mui/material/ToggleButton"
import { useDeviceState } from "@/components/SseProvider"
import { postCommand } from "@/lib/device-command"
import { tabForAnimId, colorModeCommands } from "@/lib/device-control"
import { apiToPicker, pickerToApi } from "@/lib/color"
import { LUMI_EFFECTS } from "@/lib/animations"

// One sheet for all LIGHT tiles. Animation tab only for LUMI (docs/frontend.md);
// HUE shows the Colour tab alone.
export default function DeviceControlSheet({
  device,
  open,
  onClose,
}: {
  device: Device
  open: boolean
  onClose: () => void
}) {
  const [tab, setTab] = useState(0)
  const showAnimation = device.protocol === "LUMI"
  const live = useDeviceState(device.id)

  const reachable = live?.reachable ?? device.reachable
  const disabled = !reachable

  const hue = live?.hue ?? device.hue ?? 0
  const saturation = live?.saturation ?? device.saturation ?? 255
  const colorBrightness = live?.colorBrightness ?? device.colorBrightness ?? 255
  const brightness = live?.brightness ?? device.brightness ?? 0
  const animId = live?.animId ?? device.animId ?? 0
  const animSpeed = live?.animSpeed ?? device.animSpeed ?? 128
  const animIntensity = live?.animIntensity ?? device.animIntensity ?? 128

  const apiColor = useMemo(
    () => ({ hue, saturation, colorBrightness }),
    [hue, saturation, colorBrightness],
  )
  const pickerFromApi = useMemo(() => apiToPicker(apiColor), [apiColor])

  const [pickerColor, setPickerColor] = useState(pickerFromApi)
  const draggingRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!draggingRef.current) {
      setPickerColor(pickerFromApi)
    }
  }, [pickerFromApi])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  useEffect(() => {
    if (open) {
      // Sync tab when sheet opens (or animId changes while open)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional resync on open
      setTab(tabForAnimId(animId))
    }
  }, [open, animId])

  const postColor = useCallback(
    (h: number, s: number, cb: number) => {
      for (const cmd of colorModeCommands(animId, {
        type: "color",
        hue: h,
        saturation: s,
        brightness: cb,
      })) {
        void postCommand(device.id, cmd)
      }
    },
    [device.id, animId],
  )

  const onPickerChange = useCallback(
    (c: { h: number; s: number; v: number }) => {
      setPickerColor(c)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const api = pickerToApi(c)
        postColor(api.hue, api.saturation, api.colorBrightness)
      }, 150)
    },
    [postColor],
  )

  const onColorBrightnessCommitted = useCallback(
    (_: unknown, value: number | number[]) => {
      const cb = value as number
      postColor(hue, saturation, cb)
    },
    [hue, saturation, postColor],
  )

  const postAnimation = useCallback(
    (id: number, speed: number, intensity: number) => {
      void postCommand(device.id, {
        type: "animation",
        animId: id,
        speed,
        intensity,
      })
    },
    [device.id],
  )

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
          },
        },
        backdrop: {
          sx: { backgroundColor: "var(--lumi-scrim)", backdropFilter: "blur(6px)" },
        },
      }}
    >
      <Box sx={{ p: 2, pb: 4 }}>
        <Box
          sx={{
            width: 32,
            height: 4,
            borderRadius: 2,
            backgroundColor: "rgba(255,255,255,0.2)",
            mx: "auto",
            mb: 1.5,
          }}
        />
        <Typography variant="h6" gutterBottom>
          {device.name}
        </Typography>

        {showAnimation && (
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab label="Couleur" />
            <Tab label="Animation" />
          </Tabs>
        )}

        {tab === 0 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box
              sx={{
                width: "100%",
                maxWidth: 280,
                mx: "auto",
                "& .react-colorful": {
                  width: "100%",
                  height: 200,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                },
                "& .react-colorful__saturation": {
                  borderRadius: "8px 8px 0 0",
                },
                "& .react-colorful__hue": {
                  height: 16,
                  borderRadius: "0 0 8px 8px",
                },
                "& .react-colorful__pointer": {
                  width: 20,
                  height: 20,
                  borderWidth: 2,
                },
              }}
              onPointerDown={() => {
                draggingRef.current = true
              }}
              onPointerUp={() => {
                draggingRef.current = false
              }}
              onPointerLeave={() => {
                draggingRef.current = false
              }}
            >
              <HsvColorPicker
                color={pickerColor}
                onChange={onPickerChange}
                style={{ opacity: disabled ? 0.45 : 1, pointerEvents: disabled ? "none" : "auto" }}
              />
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Luminosité
              </Typography>
              <Slider
                size="small"
                min={0}
                max={255}
                value={brightness}
                disabled={disabled}
                onChangeCommitted={(_, value) => {
                  for (const cmd of colorModeCommands(animId, {
                    type: "brightness",
                    brightness: value as number,
                  })) {
                    void postCommand(device.id, cmd)
                  }
                }}
              />
            </Box>

            {showAnimation && (
              <Box>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Luminosité couleur
                </Typography>
                <Slider
                  size="small"
                  min={0}
                  max={255}
                  value={colorBrightness}
                  disabled={disabled}
                  onChangeCommitted={onColorBrightnessCommitted}
                />
              </Box>
            )}
          </Box>
        )}

        {tab === 1 && showAnimation && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
                gap: 1,
              }}
            >
              {LUMI_EFFECTS.filter((e) => e.animId > 0).map((effect) => (
                <ToggleButton
                  key={effect.animId}
                  value={effect.animId}
                  selected={animId === effect.animId}
                  disabled={disabled}
                  onClick={() => postAnimation(effect.animId, animSpeed, animIntensity)}
                  sx={{
                    flexDirection: "column",
                    py: 1.5,
                    textTransform: "none",
                    borderColor: "divider",
                    "&.Mui-selected": {
                      borderColor: "primary.main",
                      boxShadow: "inset 0 0 16px rgba(242,180,58,0.18)",
                    },
                  }}
                >
                  {effect.label}
                </ToggleButton>
              ))}
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Vitesse
              </Typography>
              <Slider
                size="small"
                min={0}
                max={255}
                value={animSpeed}
                disabled={disabled}
                onChangeCommitted={(_, value) =>
                  postAnimation(animId, value as number, animIntensity)
                }
              />
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Intensité
              </Typography>
              <Slider
                size="small"
                min={0}
                max={255}
                value={animIntensity}
                disabled={disabled}
                onChangeCommitted={(_, value) =>
                  postAnimation(animId, animSpeed, value as number)
                }
              />
            </Box>

            <Button
              variant="outlined"
              color="primary"
              disabled={disabled || animId === 0}
              onClick={() => void postCommand(device.id, { type: "stopAnimation" })}
              sx={{ alignSelf: "flex-start" }}
            >
              Arrêter
            </Button>
          </Box>
        )}
      </Box>
    </Drawer>
  )
}

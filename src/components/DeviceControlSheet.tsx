"use client"

import { useState } from "react"
import type { Device } from "@prisma/client"
import Drawer from "@mui/material/Drawer"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Tabs from "@mui/material/Tabs"
import Tab from "@mui/material/Tab"

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

  return (
    <Drawer anchor="bottom" open={open} onClose={onClose}>
      <Box sx={{ p: 2, pb: 4 }}>
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
          <Typography variant="body2" color="text.secondary">
            {/* TODO: react-colorful wheel + master brightness (+ colour brightness for LUMI) */}
            Sélecteur de couleur — à implémenter.
          </Typography>
        )}
        {tab === 1 && showAnimation && (
          <Typography variant="body2" color="text.secondary">
            {/* TODO: effect grid + speed/intensity + stop */}
            Animations — à implémenter.
          </Typography>
        )}
      </Box>
    </Drawer>
  )
}

"use client"

import { useState } from "react"
import type { TriggerType } from "@prisma/client"
import Box from "@mui/material/Box"
import ToggleButton from "@mui/material/ToggleButton"
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup"
import Typography from "@mui/material/Typography"

// Discriminated create form (ADMIN): CRON (cronExpr + scene) or SENSOR
// (sensor device + state + scene). See docs/api.md#triggers.
export default function TriggerForm() {
  const [type, setType] = useState<TriggerType>("CRON")

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <ToggleButtonGroup
        exclusive
        value={type}
        onChange={(_, v) => v && setType(v as TriggerType)}
        size="small"
      >
        <ToggleButton value="CRON">Horaire</ToggleButton>
        <ToggleButton value="SENSOR">Capteur</ToggleButton>
      </ToggleButtonGroup>

      <Typography variant="body2" color="text.secondary">
        {/* TODO: name + scene picker; CRON → cron expression, SENSOR → sensor device + state */}
        Formulaire {type === "CRON" ? "horaire" : "capteur"} — à implémenter.
      </Typography>
    </Box>
  )
}

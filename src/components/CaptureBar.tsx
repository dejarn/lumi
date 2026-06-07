"use client"

import Typography from "@mui/material/Typography"
import FormControlLabel from "@mui/material/FormControlLabel"
import Checkbox from "@mui/material/Checkbox"
import Switch from "@mui/material/Switch"
import Fab from "@mui/material/Fab"
import CameraAltIcon from "@mui/icons-material/CameraAlt"
import GlassSurface from "@/components/ui/GlassSurface"

type CaptureBarProps = {
  captureMode: boolean
  onToggleMode: (enabled: boolean) => void
  selectAll: boolean
  onSelectAll: (checked: boolean) => void
  selectedCount: number
  onCapture: () => void
  capturing: boolean
}

export default function CaptureBar({
  captureMode,
  onToggleMode,
  selectAll,
  onSelectAll,
  selectedCount,
  onCapture,
  capturing,
}: CaptureBarProps) {
  return (
    <GlassSurface
      glow="accent"
      sx={{
        position: "sticky",
        top: 8,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        gap: 2,
        flexWrap: "wrap",
        px: 2,
        py: 1.5,
      }}
    >
      <FormControlLabel
        control={
          <Switch
            checked={captureMode}
            onChange={(e) => onToggleMode(e.target.checked)}
            color="primary"
          />
        }
        label="Mode capture"
      />

      {captureMode && (
        <>
          <FormControlLabel
            control={
              <Checkbox
                checked={selectAll}
                indeterminate={selectedCount > 0 && !selectAll}
                onChange={(e) => onSelectAll(e.target.checked)}
              />
            }
            label="Tout sélectionner"
          />
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            {selectedCount} lumière{selectedCount !== 1 ? "s" : ""} sélectionnée
            {selectedCount !== 1 ? "s" : ""}
          </Typography>
          <Fab
            variant="extended"
            size="medium"
            color="primary"
            disabled={selectedCount === 0 || capturing}
            onClick={onCapture}
          >
            <CameraAltIcon sx={{ mr: 1 }} />
            Capturer
          </Fab>
        </>
      )}
    </GlassSurface>
  )
}

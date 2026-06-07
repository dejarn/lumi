"use client"

import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import FormControlLabel from "@mui/material/FormControlLabel"
import Checkbox from "@mui/material/Checkbox"
import Switch from "@mui/material/Switch"
import Fab from "@mui/material/Fab"
import CameraAltIcon from "@mui/icons-material/CameraAlt"

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
    <Box
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
        borderRadius: 2,
        border: "1px solid",
        borderColor: "primary.main",
        backgroundColor: "rgba(20, 23, 31, 0.72)",
        backdropFilter: "var(--lumi-glass-blur)",
        WebkitBackdropFilter: "var(--lumi-glass-blur)",
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
    </Box>
  )
}

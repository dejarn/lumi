"use client"

import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Snackbar from "@mui/material/Snackbar"
import Typography from "@mui/material/Typography"
import GlassSurface from "@/components/ui/GlassSurface"
import { colors } from "@/lib/tokens"

type ToastProps = {
  open: boolean
  message: string
  actionLabel?: string
  onAction?: () => void
  onClose: () => void
}

// Degraded-state toast for a failed command (docs/design.md §System states).
export default function Toast({ open, message, actionLabel, onAction, onClose }: ToastProps) {
  return (
    <Snackbar
      open={open}
      onClose={onClose}
      autoHideDuration={6000}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <GlassSurface
        radius="xs"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 1,
          borderColor: "rgba(255,120,100,0.35)",
        }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            flexShrink: 0,
            backgroundColor: colors.error,
            boxShadow: "0 0 8px rgba(255,120,100,0.6)",
          }}
        />
        <Typography variant="body2">{message}</Typography>
        {actionLabel && onAction && (
          <Button size="small" color="primary" onClick={onAction} sx={{ ml: "auto" }}>
            {actionLabel}
          </Button>
        )}
      </GlassSurface>
    </Snackbar>
  )
}

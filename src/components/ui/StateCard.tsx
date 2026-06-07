"use client"

import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Typography from "@mui/material/Typography"
import GlassSurface from "@/components/ui/GlassSurface"
import { colors } from "@/lib/tokens"

type StateCardProps = {
  /** Visual variant — `error` adds a red accent (docs/design.md §System states). */
  variant?: "empty" | "error"
  icon: React.ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

// Centred glass card for empty / error data states. Never a dead end: empty states
// carry an actionable CTA, errors a retry.
export default function StateCard({
  variant = "empty",
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: StateCardProps) {
  const isError = variant === "error"
  return (
    <GlassSurface
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 1,
        px: 3,
        py: 5,
        ...(isError && {
          borderColor: "rgba(255,120,100,0.3)",
          boxShadow: "inset 0 0 20px rgba(255,120,100,0.05)",
        }),
      }}
    >
      <Box sx={{ fontSize: "1.6rem", lineHeight: 1, color: isError ? colors.error : "text.primary" }}>
        {icon}
      </Box>
      <Typography variant="h6">{title}</Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: "28ch" }}>
          {description}
        </Typography>
      )}
      {actionLabel && onAction && (
        <Button
          variant="outlined"
          color={isError ? "error" : "primary"}
          onClick={onAction}
          sx={{ mt: 1, borderRadius: 999 }}
        >
          {actionLabel}
        </Button>
      )}
    </GlassSurface>
  )
}

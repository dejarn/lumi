"use client"

import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import GlassSurface from "@/components/ui/GlassSurface"
import { colors } from "@/lib/tokens"

// Degraded-state banner at the top of the dashboard (docs/design.md §System states).
export default function OfflineBanner({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <GlassSurface
      radius="xs"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        py: 1,
        borderColor: "rgba(255,120,100,0.35)",
        boxShadow: "inset 0 0 14px rgba(255,120,100,0.05)",
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
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {count} appareil{count !== 1 ? "s" : ""} hors ligne
      </Typography>
    </GlassSurface>
  )
}

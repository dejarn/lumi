"use client"

import Box from "@mui/material/Box"
import GlassSurface from "@/components/ui/GlassSurface"

const shimmer = {
  borderRadius: 1,
  background:
    "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 75%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease-in-out infinite",
}

// Placeholder tile shown during the first SSE sync (docs/design.md §System states).
export default function SkeletonTile() {
  return (
    <GlassSurface
      sx={{ minHeight: 96, p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}
    >
      <Box sx={{ ...shimmer, height: 8, width: "60%" }} />
      <Box sx={{ ...shimmer, height: 8, width: "38%", mt: "auto" }} />
    </GlassSurface>
  )
}

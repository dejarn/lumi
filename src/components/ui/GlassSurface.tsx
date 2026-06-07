"use client"

import Box, { type BoxProps } from "@mui/material/Box"
import { glowStyle, radii, type GlowKind } from "@/lib/tokens"

type GlassSurfaceProps = BoxProps & {
  /** Luminous border + inset glow carrying state (docs/design.md: border = state). */
  glow?: GlowKind
  /** Corner radius token. */
  radius?: keyof typeof radii
}

// Saturated glass panel — translucent fill + blur via the theme CSS vars, with an
// optional state glow. Shared base for tiles, banners, sheets, drawer (docs/design.md).
export default function GlassSurface({
  glow = "none",
  radius = "md",
  sx,
  children,
  ...rest
}: GlassSurfaceProps) {
  const g = glowStyle[glow]
  return (
    <Box
      sx={[
        {
          backgroundColor: "var(--lumi-glass-bg)",
          backdropFilter: "var(--lumi-glass-blur)",
          WebkitBackdropFilter: "var(--lumi-glass-blur)",
          border: "1px solid",
          borderColor: g.borderColor,
          boxShadow: g.boxShadow,
          borderRadius: `${radii[radius]}px`,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...rest}
    >
      {children}
    </Box>
  )
}

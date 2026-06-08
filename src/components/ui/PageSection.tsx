"use client"

import { type JSX, type ReactNode } from "react"
import { type BoxProps } from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import GlassSurface from "@/components/ui/GlassSurface"
import { type GlowKind } from "@/lib/tokens"
import { sectionTitleSx } from "@/lib/ui-sx"

type PageSectionProps = {
  label?: string
  glow?: GlowKind
  children: ReactNode
} & BoxProps

// Glass content section with optional uppercase label and standardized internal spacing.
export default function PageSection({
  label,
  glow = "none",
  children,
  sx,
  ...rest
}: PageSectionProps): JSX.Element {
  return (
    <GlassSurface
      glow={glow}
      sx={[
        {
          display: "flex",
          flexDirection: "column",
          gap: 2,
          p: 2,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...rest}
    >
      {label && (
        <Typography component="h2" sx={{ ...sectionTitleSx, mb: 0 }}>
          {label}
        </Typography>
      )}
      {children}
    </GlassSurface>
  )
}

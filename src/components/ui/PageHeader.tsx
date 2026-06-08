"use client"

import { type JSX, type ReactNode } from "react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import GlassSurface from "@/components/ui/GlassSurface"

type PageHeaderProps = {
  title: string
  action?: ReactNode
}

// Page title bar — Bricolage h5 in a light glass strip with an optional right action slot.
export default function PageHeader({ title, action }: PageHeaderProps): JSX.Element {
  return (
    <GlassSurface
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: action ? "space-between" : "flex-start",
        gap: 2,
        px: 2,
        py: 1.5,
      }}
    >
      <Typography variant="h5" component="h1">
        {title}
      </Typography>
      {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
    </GlassSurface>
  )
}

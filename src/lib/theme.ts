"use client"

import { createTheme } from "@mui/material/styles"
import { colors, radii, glass, ambientBackground } from "@/lib/tokens"

// Lumi design language: dark, multicolour ambient canvas, saturated glass,
// luminous amber accents (docs/design.md, docs/frontend.md). Tokens prefixed --lumi-*
// and centralised in src/lib/tokens.ts.
const theme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: colors.bgBase,
      paper: colors.surface,
    },
    primary: {
      main: colors.accent,
      contrastText: "#0b0d12",
    },
    secondary: {
      main: "#8a93a6",
    },
    error: {
      main: colors.error,
    },
    success: {
      main: "#5ecf8a",
    },
    text: {
      primary: colors.text,
      secondary: colors.textMuted,
    },
    divider: colors.glassBorder,
  },
  typography: {
    fontFamily: "'DM Sans', sans-serif",
    h1: { fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: "-0.04em" },
    h2: { fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: "-0.03em" },
    h3: { fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: "-0.03em" },
    h4: { fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: "-0.03em" },
    h5: { fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: "-0.03em" },
    h6: { fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: "-0.02em" },
  },
  shape: {
    borderRadius: radii.sm,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ":root": {
          "--lumi-bg-base": colors.bgBase,
          "--lumi-glass-bg": colors.glassBg,
          "--lumi-glass-border": colors.glassBorder,
          "--lumi-glass-blur": glass.blur,
          "--lumi-accent": colors.accent,
          "--lumi-accent-dim": colors.accentDim,
          "--lumi-text": colors.text,
          "--lumi-text-muted": colors.textMuted,
          "--lumi-glow-warm": colors.glowWarm,
          "--lumi-glow-blue": colors.glowBlue,
          "--lumi-glow-sensor": colors.glowSensor,
          "--lumi-error": colors.error,
          "--lumi-scrim": colors.scrim,
          "--lumi-radius-md": `${radii.md}px`,
          "--lumi-radius-sm": `${radii.sm}px`,
          "--lumi-radius-xs": `${radii.xs}px`,
        },
        // Opaque glass when the user asks for reduced transparency (docs/design.md a11y).
        "@media (prefers-reduced-transparency: reduce)": {
          ":root": {
            "--lumi-glass-bg": colors.surface,
            "--lumi-glass-blur": "none",
          },
        },
        "@media (prefers-reduced-motion: reduce)": {
          "*, *::before, *::after": {
            animationDuration: "0.01ms !important",
            animationIterationCount: "1 !important",
            transitionDuration: "0.01ms !important",
            scrollBehavior: "auto !important",
          },
        },
        body: {
          background: ambientBackground,
          backgroundAttachment: "fixed",
          transition: "background 600ms ease",
          minHeight: "100vh",
        },
        // Signature motions (docs/design.md §Motion), referenced by name from sx.
        "@keyframes border-rainbow": {
          "0%": { borderColor: "rgba(255,120,100,0.55)" },
          "33%": { borderColor: "rgba(120,230,160,0.55)" },
          "66%": { borderColor: "rgba(100,160,255,0.55)" },
          "100%": { borderColor: "rgba(255,120,100,0.55)" },
        },
        "@keyframes wave-scroll": {
          to: { backgroundPosition: "200% 0" },
        },
        "@keyframes skeleton-shimmer": {
          to: { backgroundPosition: "-200% 0" },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: "var(--lumi-glass-bg)",
          backgroundImage: "none",
          border: "1px solid var(--lumi-glass-border)",
          borderRadius: "var(--lumi-radius-md)",
          backdropFilter: "var(--lumi-glass-blur)",
          WebkitBackdropFilter: "var(--lumi-glass-blur)",
          boxShadow: "none",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 500,
          letterSpacing: "0.01em",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: "var(--lumi-glass-bg)",
          backgroundImage: "none",
          backdropFilter: "var(--lumi-glass-blur)",
          WebkitBackdropFilter: "var(--lumi-glass-blur)",
          borderRight: `1px solid ${colors.accentDim}`,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "var(--lumi-glass-bg)",
          backgroundImage: "none",
          backdropFilter: "var(--lumi-glass-blur)",
          WebkitBackdropFilter: "var(--lumi-glass-blur)",
          borderBottom: `1px solid ${colors.accentDim}`,
          boxShadow: "none",
        },
      },
    },
  },
})

export default theme

"use client"

import { createTheme } from "@mui/material/styles"

// Lumi design language: dark, multicolour ambient canvas, saturated glass,
// luminous amber accents (docs/design.md, docs/frontend.md). Tokens prefixed --lumi-*.
const theme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#0B0D12",
      paper: "#14171F",
    },
    primary: {
      main: "#F2B43A",
      contrastText: "#0B0D12",
    },
    secondary: {
      main: "#8A93A6",
    },
    error: {
      main: "#E06A6A",
    },
    success: {
      main: "#5EC2A0",
    },
    text: {
      primary: "#EEF1F7",
      secondary: "#8A93A6",
    },
    divider: "rgba(242,180,58,0.15)",
  },
  typography: {
    fontFamily: "'DM Sans', sans-serif",
    h1: { fontFamily: "'Bricolage Grotesque', sans-serif" },
    h2: { fontFamily: "'Bricolage Grotesque', sans-serif" },
    h3: { fontFamily: "'Bricolage Grotesque', sans-serif" },
    h4: { fontFamily: "'Bricolage Grotesque', sans-serif" },
    h5: { fontFamily: "'Bricolage Grotesque', sans-serif" },
    h6: { fontFamily: "'Bricolage Grotesque', sans-serif" },
  },
  shape: {
    borderRadius: 14,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ":root": {
          "--lumi-background": "#0B0D12",
          "--lumi-surface": "#14171F",
          "--lumi-surface-raised": "#1B1F29",
          "--lumi-accent": "#F2B43A",
          "--lumi-accent-muted": "rgba(242,180,58,0.15)",
          "--lumi-text-primary": "#EEF1F7",
          "--lumi-text-secondary": "#8A93A6",
          "--lumi-glass-blur": "blur(12px) saturate(130%)",
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
          background:
            "radial-gradient(circle at 50% 50%, var(--lumi-ambient, transparent) 0%, transparent 60%), radial-gradient(circle at 15% 0%, rgba(242,180,58,0.07) 0%, transparent 38%), radial-gradient(circle at 85% 100%, rgba(94,194,160,0.05) 0%, transparent 42%), #0B0D12",
          transition: "background 600ms ease",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
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
          backgroundColor: "#14171F",
          borderRight: "1px solid rgba(242,180,58,0.15)",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#14171F",
          backgroundImage: "none",
          borderBottom: "1px solid rgba(242,180,58,0.15)",
          boxShadow: "none",
        },
      },
    },
  },
})

export default theme

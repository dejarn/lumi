// Lumi design tokens — single source of truth mirroring docs/mockups/moodboard.html
// :root and docs/design.md. Consumed by the MUI theme and the ui/ primitives so a
// visual tweak lives in exactly one place.

export const colors = {
  bgBase: "#0c0e14",
  glassBg: "rgba(255, 255, 255, 0.07)",
  glassBorder: "rgba(255, 255, 255, 0.14)",
  accent: "#f0a84a",
  accentDim: "rgba(240, 168, 74, 0.45)",
  text: "rgba(255, 255, 255, 0.94)",
  textMuted: "rgba(255, 255, 255, 0.52)",
  glowWarm: "rgba(255, 176, 80, 0.45)",
  glowBlue: "rgba(90, 154, 255, 0.45)",
  glowSensor: "rgba(94, 207, 138, 0.35)",
  insetWarm: "rgba(255, 160, 60, 0.08)",
  error: "#ff7864",
  scrim: "rgba(0, 0, 0, 0.5)",
  // Opaque fallbacks for prefers-reduced-transparency.
  surface: "#14171f",
  surfaceRaised: "#1b1f29",
} as const

export const radii = {
  md: 16,
  sm: 12,
  xs: 10,
} as const

export const glass = {
  blur: "blur(12px) saturate(130%)",
} as const

// Three radial layers driven live behind everything (docs/design.md §Ambient canvas).
// `--lumi-ambient` is set dynamically on scene activation; the other layers are static.
export const ambientBackground = [
  "radial-gradient(ellipse 70% 55% at 15% 78%, var(--lumi-ambient, rgba(255,150,60,0.10)), transparent 68%)",
  "radial-gradient(ellipse 55% 45% at 82% 22%, rgba(80,140,255,0.10), transparent 62%)",
  "radial-gradient(ellipse 42% 36% at 52% 48%, rgba(160,90,240,0.07), transparent 58%)",
  colors.bgBase,
].join(", ")

// Per-state glow → border colour + inset boxShadow. Keyed by the device's visual state.
export type GlowKind = "warm" | "blue" | "sensor" | "accent" | "none"

export const glowStyle: Record<GlowKind, { borderColor: string; boxShadow: string }> = {
  warm: { borderColor: colors.glowWarm, boxShadow: `inset 0 0 14px ${colors.insetWarm}` },
  blue: { borderColor: colors.glowBlue, boxShadow: "inset 0 0 14px rgba(90,154,255,0.08)" },
  sensor: { borderColor: colors.glowSensor, boxShadow: "inset 0 0 14px rgba(94,207,138,0.08)" },
  accent: { borderColor: colors.accentDim, boxShadow: "inset 0 0 14px rgba(240,168,74,0.10)" },
  none: { borderColor: colors.glassBorder, boxShadow: "none" },
}

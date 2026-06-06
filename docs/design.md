# Design

_Last updated: 2026-06-06_

Visual reference: [mockups/moodboard.html](mockups/moodboard.html). Behavioural source of truth: [frontend.md](frontend.md).

## Concept

**"Lumière vivante"** — the app _is_ the light. The interface borrows the warmth, colour and glow of the bulbs it controls. State is never read from a label first: it is **felt** through colour, border and an ambient canvas that reacts to whatever is on in the flat.

Used one-handed, phone in hand, in real living spaces (often dim). Must stay readable under low light while feeling like an extension of the lighting itself.

Dark theme only. Mobile-first.

---

## Typography

| Usage | Font | Source |
|---|---|---|
| Headings, display, logo, scene names | **Bricolage Grotesque** | Google Fonts |
| UI, body, labels, device states | **DM Sans** | Google Fonts |

- Display weight 700, tight tracking (`-0.03em` to `-0.04em`) for the logo and large titles.
- Device states (`72 %`, `Animation · Arc-en-ciel`, `Hors ligne`) always in DM Sans.
- Never use system fonts or Inter/Roboto.

---

## Color palette

Tokens prefixed `--lumi-*`, wired into the MUI theme via `cssVariables`.

| Token | Value | Usage |
|---|---|---|
| `--lumi-bg-base` | `#0c0e14` | Page background — cool near-black |
| `--lumi-glass-bg` | `rgba(255,255,255,0.07)` | Glass surface fill (tiles, bars, sheets) |
| `--lumi-glass-border` | `rgba(255,255,255,0.14)` | Default glass border |
| `--lumi-accent` | `#f0a84a` | Active chrome — nav, app-bar edge, FAB, CTA — warm amber |
| `--lumi-accent-dim` | `rgba(240,168,74,0.45)` | Active borders, selected state, segment-on |
| `--lumi-text` | `rgba(255,255,255,0.94)` | Main text |
| `--lumi-text-muted` | `rgba(255,255,255,0.52)` | Labels, metadata, device sub-state |
| `--lumi-glow-warm` | `rgba(255,176,80,0.45)` | Tile border — warm light ON |
| `--lumi-glow-blue` | `rgba(90,154,255,0.45)` | Tile border — cool light ON |
| `--lumi-glow-sensor` | `rgba(94,207,138,0.35)` | Tile border — active sensor |
| `error` | `#ff7864` | Errors, offline devices, failed commands |

**Ambient canvas** — three radial gradients (`--lumi-ambient-1/2/3`, warm / blue / violet) layered behind everything, driven live from the devices that are on (see Motion).

No MUI default blue. Glass is **saturated**: `backdrop-filter: blur(12px) saturate(130%)`.

---

## Design language — border = state

One rule, applied everywhere: **the luminous border carries state.** Same accent/colour vocabulary across the whole app.

| Element | Border signal |
|---|---|
| Device tile ON | Warm or blue glow + inset glow, colour follows the bulb |
| Device tile animating (`animId > 0`) | Cycling rainbow border + `Animation · {name}` label + wave bar |
| Device tile OFF | Default glass border, no glow |
| Device tile offline | Default border, `opacity 0.4` + grayscale + explicit `Hors ligne` label |
| Sensor active | Green sensor glow |
| Nav item active | Amber accent border + inset glow |
| Scene active | Amber accent border + inset glow |
| Capture — selected tile | Amber accent border + outline + `✓` |

Because colour alone is not an accessible signal, every state also carries a **text label** (`ON · 72%`, `Hors ligne`, `Animation · …`, `Sélectionné`).

---

## Motion

Restrained, but light _is_ motion here — a few signature animations carry the brand.

| Moment | Animation |
|---|---|
| Ambient canvas | Slowly shifts toward the average colour of devices that are on; transitions ~0.5–1 s on scene activation |
| Tile animating | Border cycles through colours (4 s loop); wave bar scrolls (2.5 s loop) |
| Scene activation | Active card gains luminous border; ambient canvas shifts toward the scene's average colour |
| Bottom sheet | Slides up from bottom, backdrop blur |
| Drawer | Slides from left over a scrim, dimmed page behind |
| Skeleton load | Shimmer sweep (1.4 s) on placeholder tiles |

No animation on form fields, sliders, or standard navigation. SSE state patches update tiles without a reload.

---

## Component details

**Glass surfaces**: `--lumi-glass-bg` fill, `--lumi-glass-border`, `blur(12px) saturate(130%)`. Radii `--lumi-radius-md` 16px / `-sm` 12px / `-xs` 10px. No harsh drop shadows on tiles; depth comes from glass + glow.

**Device tile**: name (DM Sans 600) + state line + optional inline brightness slider. Border colour follows device state. Tap body → `DeviceControlSheet`. Toggle + quick slider stay **inline** on the tile.

**Device control sheet** (`DeviceControlSheet`, one component):
- Bottom sheet, drag handle, glass over a blurred scrim.
- **LUMI**: segmented `Couleur | Animation`. Colour tab = hue wheel + master brightness + colour brightness. Animation tab = effect grid + speed/intensity + stop.
- **HUE**: Animation tab **hidden**. Colour tab only — wheel + **one** brightness slider.

**Scene card**: name (Bricolage) + meta (`4 appareils · active`). Active scene = luminous accent border. ADMIN: `⋯` menu for rename/delete.

**Capture banner** (ADMIN dashboard capture mode): glass banner — scene name, selection count, **Tout ✓** (select all). Selectable tiles below, FAB **Capturer l'état** bottom-right.

**Drawer (AppDrawer)**: slides from left, glass, accent border on the right edge. "Lumi" in Bricolage at top. Active item amber-bordered + inset glow. `ADMIN` section divider before admin routes.

**FAB**: pill, amber `rgba(240,168,74,0.2)` fill + accent-dim border + accent text.

---

## System states

Every data surface defines four states beyond the happy path. See the **États système** panel in the moodboard.

| State | Treatment |
|---|---|
| **Loading** | Skeleton tiles with shimmer sweep during first SSE sync. Chrome (bar) stays visible. |
| **Error** | Glass card, red accent — icon + title (`Bridge injoignable`) + cause + **Réessayer** button. |
| **Empty** | Glass card — icon + title (`Aucune scène`) + actionable CTA (`Capturer une scène`). Never a dead end. |
| **Degraded** | Offline banner (red dot + count) at top of dashboard; offline tiles dimmed with explicit label; failed command shows a toast (`Échec — {device} n'a pas répondu` · **Réessayer**). |

Commands return `202`; state is confirmed over SSE. A command with no SSE confirmation within the timeout surfaces the degraded toast.

---

## Microcopy

Tone: **direct, brief, French**. No exclamation marks, no over-friendly language. Flatmates, not customers.

| Context | Example |
|---|---|
| Empty — scenes | "Aucune scène. Règle tes lumières puis capture l'état." |
| Empty — triggers | "Aucun déclencheur." |
| Capture hint | "Sélectionne les appareils à inclure, puis capture l'état." |
| Bridge error | "Bridge injoignable. Vérifie que le pont est allumé et sur le même réseau." |
| Command failed | "Échec — {appareil} n'a pas répondu." |
| Device offline | "Hors ligne" |
| Delete confirmation | "Supprimer cette scène ? Cette action est irréversible." |
| Generic error | "Une erreur est survenue. Réessaie." |

---

## Key user flows

### 1. Control a light (USER)

1. Open `/dashboard` — tiles live via SSE.
2. Quick: toggle / drag the inline brightness slider on the tile.
3. Fine: tap the tile body → `DeviceControlSheet` → wheel + brightness (+ animation for LUMI).
4. Command returns `202`; the tile catches up when SSE confirms.

### 2. Capture a scene (ADMIN)

1. `/scenes` → create or pick a scene → enter **capture mode**.
2. Dashboard shows the capture banner + selectable tiles.
3. Adjust the lights to the desired look.
4. Select the devices to include (or **Tout ✓**).
5. FAB **Capturer l'état** → `POST /api/scenes/[id]/capture` with `deviceIds`.

### 3. Activate a scene (USER)

1. `/scenes` → tap a scene card.
2. `POST /activate`. Card gains a luminous border; ambient canvas shifts toward the scene's average colour (~0.5–1 s).
3. Tiles catch up via SSE.

---

## Accessibility

- Minimum contrast 4.5:1 for body text, 3:1 for large text (WCAG AA). Verify muted text on glass over the ambient canvas — the riskiest combination.
- State is **never colour-only**: every coloured border is paired with a text label.
- `prefers-reduced-motion` → fixed borders, no canvas shift, no shimmer; keep functional state feedback.
- `prefers-reduced-transparency` → opaque glass instead of blur.
- All interactive elements reachable by keyboard; sheet and drawer trappable and dismissible.

# Frontend

_Last updated: 2026-06-05_

## Framework & routing

- **Framework**: Next.js 16 App Router + React 19
- **Rendering**: Server Components by default. Client Components (`"use client"`) only where interactivity is needed — device tiles, color pickers, scene capture, trigger forms, the SSE listener.
- **Approach**: Mobile-first. The dashboard is the primary daily-use view and is designed for a phone in hand. All layouts target small screens first.

## Design system

| Layer | Choice |
|---|---|
| Foundation | Dark, multicolour ambient canvas (lightened ~30 % for readability) |
| Glass | Saturated — `blur(12px) saturate(130 %)` |
| Device tiles | Luminous border — colour follows device state; inset glow when ON |
| Chrome | Luminous borders — accent amber on active nav item and app bar edge |
| Animation state (`animId > 0`) | Cycling border + label `Animation · {name}` + wave bar (no brightness slider on tile) |

Typography: **Bricolage Grotesque** (display), **DM Sans** (body). Tokens prefixed `--lumi-*`.

## UX decisions (high impact)

| Topic | Decision |
|---|---|
| **Dashboard layout** | Two sections — **Lights** then **Sensors** (`kind`). Flat 2-column grid within each section. No room/zone grouping in v1 (no `room` field; `Device.zone` is LUMI hardware only). Good naming convention for admins (`Salon plafond`, …). |
| **Scene activation (USER)** | Tap → `POST /activate`. Feedback: **luminous border** on the active scene card + **ambient canvas** transitions toward the average colour of the scene's saved `SceneDevice` rows (~0.5–1 s). Tiles then catch up via SSE. No toast in v1. |
| **Scene capture (ADMIN)** | **Dashboard capture mode** — not a standalone wizard. Flow: `/scenes` → create or pick scene → enter capture mode → dashboard shows a glass banner + selectable tiles → FAB **Capture state** → `POST /scenes/[id]/capture`. Shortcut **Select all** in the banner. Admin adjusts lights first, then selects devices and captures. Rename/delete via `⋯` menu on scene cards. |
| **Hue vs LUMI sheet** | One `DeviceControlSheet`; Animation tab only when `protocol === 'LUMI'`. |

---

## UI & components

- **Component library**: MUI v9 (Material UI)
- **Navigation**: Burger menu (drawer) — opens from the side. Persistent on desktop if the screen allows.
- **Colour & brightness control**: `react-colorful` for the hue/saturation wheel, MUI `Slider` for brightness. Field ranges follow the protocol (`hue` 0–65535, `saturation`/`brightness` 0–255 — see [api.md](api.md#devices)).
- **Device control sheet** (all `LIGHT` tiles — tap outside toggle/slider): single **`DeviceControlSheet`** bottom sheet (no dedicated route). Behaviour by protocol:
  - **LUMI**: segmented **Couleur | Animation**. Colour tab: wheel + master brightness + colour brightness. Animation tab: effect grid + speed/intensity + stop.
  - **HUE**: same sheet, **Animation tab hidden**. Colour tab only: wheel + **one** brightness slider (no colour-brightness slider in v1).
  - Toggle ON and quick brightness slider stay **inline on the tile** for all lights.
- **Real-time**: Native `EventSource` (SSE) against the global `/api/stream`. One subscription per session; every device tile reads from it.

## State management

No global state library. Data flows via:
- **Server Components** for initial data fetch (device, scene, trigger lists via Prisma).
- **`useState` / `useReducer`** for local interactive state (color picker, scene capture selection, trigger form).
- **SSE** for live device-state updates — the dashboard applies per-device patches to local state, no full reload.

The SSE stream carries **only device state** (see [api.md](api.md#stream-sse)). The UI never receives "a trigger fired" — only the resulting device-state change. Tiles re-render off whatever the latest state patch says.

---

## Route map

| Route | Auth | Description |
|---|---|---|
| `/login` | Public | Username + password login form |
| `/invite/[token]` | Public | Registration form via invite token |
| `/` | USER | Redirects to `/dashboard` |
| `/dashboard` | USER | Device tiles in **Lights** / **Sensors** sections. Live via SSE. |
| `/scenes` | USER | Scene list — activate. Create/edit/capture/delete are ADMIN. |
| `/triggers` | USER | Trigger list — view + enable/disable. Create/edit/delete are ADMIN. |
| `/admin/devices` | ADMIN | Manage auto-discovered devices — rename, set zone, remove, trigger discovery |
| `/admin/users` | ADMIN | Account management — create, set role, deactivate, delete |

Roles: `ADMIN` > `USER`. Within a shared route, USER-safe actions are always available; ADMIN-only actions are gated in the UI and re-checked server-side ([api.md](api.md#roles)).

`/invite/[token]` is validated against `GET /api/invites/[token]` before rendering the form, then submitted via `POST /api/invites/[token]/accept` ([api.md](api.md#invites)).

---

## Layouts

| Layout | Routes | Content |
|---|---|---|
| `AuthLayout` | `/login`, `/invite/[token]` | Centered card, no nav |
| `AppLayout` | All authenticated routes | Burger drawer, top app bar, main content area, SSE provider mounted once |

---

## Key screens

- **Dashboard (`/dashboard`)** — Two sections: **Lights** (grid of control tiles) and **Sensors** (read-only). Each light tile: name, reachability, power toggle, brightness slider. Tap tile body → `DeviceControlSheet`. SENSOR tiles: active/idle only. Optional **capture mode** (ADMIN): banner + selectable tiles + FAB when snapshotting a scene. Commands return `202`; state confirmed over SSE.
- **Scenes (`/scenes`)** — Scene cards; tap to activate (luminous active state + ambient canvas shift). ADMIN: create scene, launch **capture mode** on dashboard, rename/delete via card menu. Capture calls `POST /api/scenes/[id]/capture` with selected `deviceIds`.
- **Triggers (`/triggers`)** — Glass cards with natural-language summaries (cron → French schedule, sensor → device + presence/absence). Enable/disable toggle (`PATCH`) for all users. ADMIN: create/edit via bottom sheet (`TriggerSheet`), delete with confirmation, FAB to add. See [automation.md](automation.md) for firing semantics.
- **Admin · Devices (`/admin/devices`)** — Devices are auto-discovered (no create). Rename, set zone (LUMI only), remove stale devices, trigger a discovery sweep.
- **Admin · Users (`/admin/users`)** — List users, issue invites (`POST /api/invites` → copyable link), revoke pending invites, change role, set `active: false` to cut off a departed flatmate instantly (see [api.md](api.md#users)).
- **Login / Invite** — Centered card. Login = credentials. Invite = token validated then registration via `/invite/[token]` ([api.md](api.md#invites)).

---

## Data fetching pattern

```
Server Component (page.tsx)
  └── fetch data from DB via Prisma (server-side)
  └── pass as props to Client Components where needed

Client Component
  └── useState for local mutations
  └── fetch() calls to Route Handlers for create/update/delete/command
  └── device state updates arrive via SSE — not router.refresh()
```

Device-state changes are **never** re-fetched manually: the dashboard applies SSE patches. CRUD mutations on scenes/triggers/users/device-config use `router.refresh()` to re-run the Server Component fetch.

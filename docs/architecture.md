# Architecture

_Last updated: 2026-05-20_

Lumi uses a Next.js application for the UI and API layer, paired with a dedicated `mqtt-bridge` service that maintains persistent connections to the MQTT broker and the Hue local API. The two services communicate over an internal Docker network. PostgreSQL is the single source of truth for device state and application data.

```
Browser
  │
  └── HTTPS ──► Traefik (reverse proxy, TLS)
                     │
                     ▼
               Next.js (App Router)
                 ├── React Server Components (pages, layouts)
                 ├── Client Components (device tiles, scene cards)
                 ├── Route Handlers (REST API + SSE stream)
                 └── Prisma Client ──► PostgreSQL
                          ▲
                          │ writes device state
                     mqtt-bridge (Node.js)
                          │
                          ├── Mosquitto (MQTT broker)
                          │     ├── Zigbee2MQTT ──► Zigbee sensors / Hue bulbs*
                          │     └── ESP32 LED strips  (lumi-protocol, binary over MQTT)
                          │
                          └── Hue Bridge (local REST API v2) ──► Philips Hue bulbs
```

\* Hue bulbs are controlled via the Hue Bridge REST API, not via Zigbee2MQTT, in v1.

## Stack

| Layer | Technology | Role |
|---|---|---|
| Frontend | Next.js 16 App Router + React 19 | Pages, layouts, client components |
| API | Next.js Route Handlers | REST endpoints, SSE stream |
| ORM | Prisma 7 | Schema, migrations, type-safe queries |
| Database | PostgreSQL 18 | Persistent data — devices, scenes, triggers, users, state |
| Auth | NextAuth.js v5 (Auth.js) | JWT sessions, credentials provider |
| Auth strategy | JWT + per-request DB check | Long maxAge, revocable via `User.active` |
| Real-time | SSE via Route Handler | Device state pushed to browser on change |
| Styling | MUI v9 (Material UI) | Component library — mobile-first |
| Testing | Vitest | Unit tests for frame encoding and trigger logic |
| Language | TypeScript (strict mode) | End-to-end type safety |
| MQTT bridge | Node.js service (Fastify + mqtt.js) | Persistent broker connection, protocol routing |
| MQTT broker | Mosquitto | Message bus for ESP32 and Zigbee2MQTT |
| Zigbee | Zigbee2MQTT + CC2652P dongle | Open Zigbee coordinator for presence sensors |

## Authentication & Authorization

- **Strategy**: JWT sessions (NextAuth.js v5, credentials provider — aligns with cadanse). Long `maxAge`, so no frequent re-login. Revocation does not rely on token expiry: every authenticated request re-validates the JWT's `userId` against the DB and rejects if the user is missing or `active = false`. This lets an admin cut off a departed flatmate instantly without a server-side session store.
- **Roles**: `ADMIN`, `USER`. Role stored on the `User` model.
- **Admin**: Full access — device registration, scene and trigger management, user management.
- **User**: Can activate scenes and control devices individually.
- **Protected routes**: All app routes require an active session. Middleware enforces this at the edge.

## Device integration

Three protocols are abstracted behind `mqtt-bridge`. Next.js never communicates with devices directly.

| Protocol | Devices | How mqtt-bridge handles it |
|---|---|---|
| Hue local API v2 | Philips Hue bulbs | HTTP REST calls to Hue Bridge on the local network |
| Zigbee (open, via MQTT) | Presence sensors | Subscribe to `zigbee2mqtt/+` topics on Mosquitto |
| lumi-protocol (MQTT) | ESP32 LED strips | Binary frames over `lumi/device/+` MQTT topics |

**Command flow (Next.js → device):** Route Handler → HTTP POST to `mqtt-bridge` internal API → mqtt-bridge routes to correct protocol → device.

**State flow (device → Next.js):** Device publishes MQTT message → mqtt-bridge receives → writes updated state to PostgreSQL → Next.js SSE Route Handler detects change → pushes to browser.

### lumi-protocol (ESP32)

Binary framing over MQTT. Frame layout: `VER(1) | OPC(1) | DEVICE_ID(2) | SEQ(1) | TOTAL_LEN(2) | PAYLOAD(N) | CRC-16(2)`. Full specification: [`lumi-protocol` repo](../lumi-protocol/spec/v1/protocol.md).

Key behaviors mqtt-bridge implements:
- Frame encoder/decoder with CRC-16/CCITT (poly `0x1021`, init `0xFFFF`)
- SEQ counter per device (0–255 wrapping)
- ACK timeout (5 s) on state-mutating commands → `Promise` rejects with `LumiTimeoutError`. This does **not** mark the device unreachable — an ACK failure can mean a busy device, not an offline one. Reachability is tracked separately (see Device reachability).
- Auto-discovery: `lumi/discovery/announce` → upsert device in PostgreSQL

## Device reachability

`Device.reachable` reflects whether a device is currently online. It is detected differently per protocol, all written to PostgreSQL by `mqtt-bridge`:

| Protocol | Mechanism |
|---|---|
| LUMI (ESP32) | MQTT **Last Will & Testament** on `lumi/device/{id}/availability` (`online`/`offline`, retained). The broker publishes `offline` automatically on disconnect once keepalive expires — no polling. **This is the only reachability signal for LUMI**: ACK timeouts do not affect it. |
| ZIGBEE | Zigbee2MQTT `availability` topic. |
| HUE | Periodic poll of the Hue REST `reachable` field on the Hue Bridge. |

`mqtt-bridge` subscribes to `lumi/device/+/availability`, writes `Device.reachable`, and the SSE stream pushes the change to the dashboard (offline tiles are greyed out).

Because the LUMI `availability` and `state` topics are **retained** (see [lumi-protocol spec](../lumi-protocol/spec/v1/protocol.md)), any third-party MQTT client can passively monitor device presence and state directly off the broker — without going through `mqtt-bridge` or the database.

## Real-time

The dashboard connects to a SSE Route Handler (`GET /api/stream`). When mqtt-bridge writes a new device state to PostgreSQL, the SSE handler detects the change and pushes the updated state to all connected clients. No WebSocket, no external pub/sub service.

## Data strategy

- Single source of truth: PostgreSQL.
- mqtt-bridge writes device state on every incoming MQTT message or Hue event. Next.js reads state from the DB — it never calls devices directly.
- SSE stream pushes targeted state updates. Clients apply patches to local React state — no full page reload on device change.

## Infrastructure

| Component | Details |
|---|---|
| Host | Raspberry Pi 4 (4 GB RAM, self-hosted) |
| Containerization | Docker Compose |
| Reverse proxy | Traefik (TLS via Let's Encrypt, rate limiting on `/api/auth`) |
| CI | GitHub Actions — lint, typecheck, Vitest on every PR |
| CD | GitHub Actions self-hosted runner on Pi — triggered on release |

### Docker Compose services

| Service | Image | Network |
|---|---|---|
| `app` | Custom Next.js multi-stage build | `internal` + `traefik` |
| `mqtt-bridge` | Custom Node.js build | `internal` only |
| `db` | `postgres:18-alpine` | `internal` only |
| `mosquitto` | `eclipse-mosquitto:alpine` | `internal` only |
| `zigbee2mqtt` | `koenkk/zigbee2mqtt` | `internal` only |

`mqtt-bridge`, `db`, `mosquitto`, and `zigbee2mqtt` are never exposed through Traefik. Only `app` is reachable from the internet.

Local dev: `pnpm dev` for Next.js + `docker compose up -d db mosquitto` — no Traefik, no mqtt-bridge in watch mode (can be started separately with `pnpm --filter mqtt-bridge dev`).

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| mqtt-bridge as separate service | Yes | Next.js cannot hold a persistent MQTT connection across requests |
| State written to PostgreSQL by bridge | Yes | Single source of truth; Next.js reads DB, never devices |
| Real-time transport | SSE | Server-to-client only; simpler than WebSocket for state push |
| Hue via REST, not Zigbee2MQTT | v1: keep Hue Bridge | Avoids re-pairing bulbs; Hue local API v2 works fully offline |
| ORM | Prisma | Type-safe queries, auto migrations, matches cadanse |
| Auth | NextAuth.js v5 + JWT, per-request DB check | Credentials provider only supports JWT (matches cadanse); DB check on `User.active` gives instant revocation for the shared-flat case |
| Testing scope | Vitest on frame encoding + trigger logic | CRUD covered by TypeScript; binary protocol and cron edge cases need explicit tests |
| Deployment trigger | GitHub Release | Explicit promotion gate before hitting production Pi |

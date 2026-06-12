# lumi

> Self-hosted home automation platform for a shared flat, running on a Raspberry Pi — no cloud, no Home Assistant.

![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white) ![React 19](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black) ![Prisma 7](https://img.shields.io/badge/Prisma-7-2d3748?logo=prisma&logoColor=white) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169e1?logo=postgresql&logoColor=white) ![MUI v9](https://img.shields.io/badge/MUI-9-007fff?logo=mui&logoColor=white)

lumi is the heart of the **lumi** ecosystem: a Next.js web app (UI + REST/SSE API) paired with a dedicated `mqtt-bridge` service. It controls Philips Hue bulbs (Hue local REST API), Zigbee sensors (Zigbee2MQTT), and custom ESP32 LED strips — the latter through the [lumi-protocol](https://github.com/dejarn/lumi-protocol) binary protocol, talking to boards running [lumi-firmware](https://github.com/dejarn/lumi-firmware). PostgreSQL is the single source of truth for all device state.

```
            Browser (mobile-first, Glass UI)
                    │  HTTPS + SSE
              Next.js app  ←  this repo (src/)
                    │  Postgres (source of truth)
                    │  LISTEN/NOTIFY device_state
              mqtt-bridge   ←  this repo (bridge/)
              lumi-protocol [Node.js]
         ┌──────────┼──────────────┐
   Hue Bridge   Zigbee2MQTT    Mosquitto (MQTT)
   (REST v2)    (sensors)          │
                              ESP32 LED strips
                              lumi-firmware
```

## How it works

The architecture follows one rule: **devices never talk to the browser, and the browser never talks to devices.** Everything flows through PostgreSQL.

1. The UI calls a REST Route Handler (e.g. `POST /api/devices/:id/command`), which returns `202 Accepted` and forwards the command to the bridge.
2. The bridge translates it to the right protocol (lumi-protocol frame, Zigbee2MQTT topic, or Hue REST call).
3. When the device confirms (ACK, state report, poll), the bridge writes the new state to Postgres and issues `NOTIFY device_state, '<deviceId>'`.
4. The SSE endpoint (`GET /api/stream`) holds a `LISTEN device_state` connection and pushes the patch to every connected browser.

No WebSocket, no polling, no external pub/sub — Postgres LISTEN/NOTIFY is the only real-time channel.

| Concern | Where it lives |
|---|---|
| UI, REST API, SSE stream | Next.js app (`src/`) |
| Automation triggers (CRON + sensor) | Next.js server (`src/lib/automation/`) |
| Device I/O (MQTT, Hue, lumi-protocol) | `mqtt-bridge` (`bridge/`) |
| Device state, users, scenes, triggers | PostgreSQL (`prisma/`) |

### Key design decisions

- **Best-effort delivery** — command routes return `202`; the *confirmed* state arrives async over SSE. No retry queue, no rollback on partial scene failure.
- **Instant revocation** — NextAuth v5 JWT sessions, but every request re-checks `User.active` against the DB. A departed flatmate is cut off immediately, no session store needed.
- **Internal-only bridge** — reachable only from the app container, guarded by a `BRIDGE_TOKEN` header. Never exposed through Traefik.
- **Protocol is consumed, never reimplemented** — the bridge uses the `lumi-protocol` Node library (`LumiCodec`, `LumiClient`), pinned to the same git tag as the firmware.

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 22+ and [pnpm](https://pnpm.io/)
- PostgreSQL and Mosquitto running locally (local dev is native — no Docker)

### Setup

```bash
git clone https://github.com/dejarn/lumi.git
cd lumi
pnpm install
cp .env.example .env          # Postgres + Mosquitto on localhost
pnpm prisma migrate dev       # apply migrations
```

### Run (with real hardware)

```bash
pnpm dev                          # Next.js dev server
pnpm --filter mqtt-bridge dev     # real bridge, separate terminal
```

### Run (no hardware needed)

The fake-bridge simulates devices end-to-end — no MQTT broker, no Hue Bridge, no ESP32:

```bash
pnpm db:seed        # seed dev devices
pnpm dev:fake       # Next.js + fake-bridge together
```

> [!TIP]
> Set `FAKE_SENSOR_MS=15000` to make the fake-bridge emit periodic sensor events, useful for testing sensor triggers.

### Tests & checks

```bash
pnpm test                     # vitest (frame encoding + trigger logic)
pnpm lint && pnpm typecheck   # CI checks, run on every PR
```

## Features

- **Device control** — power, brightness, full HSB color (color wheel via `react-colorful`) for Hue bulbs and ESP32 LED strips, grouped by room.
- **Scenes** — capture the current state of a set of devices and replay it in one tap.
- **Automations** — `CRON` triggers (node-cron) and `SENSOR` triggers (fired on Postgres `device_state` notifications) that activate scenes or device commands.
- **Live state** — every state change, whatever its origin (app, physical switch, sensor), streams to all open browsers over SSE.
- **Invite-only auth** — the first `ADMIN` is bootstrapped from env vars; everyone else joins via invite link. No open registration.
- **Reachability tracking** — MQTT LWT for ESP32 strips, Zigbee2MQTT availability for sensors, periodic Hue polling for bulbs.

> [!NOTE]
> v1 triggers have **no debounce** — a noisy presence sensor fires its trigger on every state flip. Accepted trade-off, see [`docs/automation.md`](docs/automation.md).

## Production (Raspberry Pi)

The full stack runs as Docker Compose on the Pi; only the app is exposed to the internet, through an external Traefik network (TLS via Let's Encrypt, rate-limited `/api/auth`).

```bash
docker compose up -d
```

| Service | Image | Exposure |
|---|---|---|
| `app` | Next.js multi-stage build | via Traefik (only internet-facing) |
| `mqtt-bridge` | Node.js build | internal only |
| `db` | `postgres:18-alpine` | internal only |
| `mosquitto` | `eclipse-mosquitto:alpine` | internal only |
| `zigbee2mqtt` | `koenkk/zigbee2mqtt` | internal only |

Deployment is triggered by a GitHub Release, picked up by a self-hosted runner on the Pi.

### Environment variables

| Var | Meaning |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `MQTT_URL` | Mosquitto broker (bridge) |
| `HUE_BRIDGE_IP` | Philips Hue Bridge (local REST API v2) |
| `BRIDGE_TOKEN` | Shared secret guarding the bridge API |
| `AUTH_SECRET` | NextAuth JWT signing secret |

See [`.env.example`](.env.example) for the full list, including first-admin bootstrap credentials.

## Documentation

| Doc | What it covers |
|---|---|
| [`docs/vision.md`](docs/vision.md) | Problem, scope, core concepts, accepted trade-offs |
| [`docs/architecture.md`](docs/architecture.md) | Stack, services, auth strategy, real-time, infra |
| [`docs/api.md`](docs/api.md) | REST endpoints, SSE stream, invite flow |
| [`docs/bridge.md`](docs/bridge.md) | mqtt-bridge internals, LISTEN/NOTIFY back to the browser |
| [`docs/automation.md`](docs/automation.md) | Trigger evaluation (CRON/SENSOR), firing semantics |
| [`docs/database.md`](docs/database.md) | Postgres schema, enums, entities, relationships |
| [`docs/frontend.md`](docs/frontend.md) | App Router route map, layouts, components, state |
| [`docs/design.md`](docs/design.md) | Design language (Glass UI, luminous borders, dark/mobile-first) |

## Related

- [lumi-protocol](https://github.com/dejarn/lumi-protocol) — the binary MQTT protocol + Node.js/Arduino libraries
- [lumi-firmware](https://github.com/dejarn/lumi-firmware) — the firmware for the custom ESP32 LED strip controllers

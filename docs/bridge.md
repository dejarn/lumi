# mqtt-bridge

_Last updated: 2026-06-05_

`mqtt-bridge` is the service that connects Lumi to the physical devices. Next.js never talks to a device directly — it calls this service over an internal HTTP API, and this service owns every protocol connection. It is a thin orchestrator on top of the `lumi-protocol` **`bridge/node`** library (see [lumi-protocol/docs/api.md](https://github.com/dejarn/lumi-protocol/blob/main/docs/api.md)); the library does the framing/CRC/ACK, this service does the wiring, the HTTP surface, and the database I/O.

## Why a separate service

Next.js Route Handlers are request-scoped — they cannot hold a persistent MQTT connection or a long-lived Hue session across requests. `mqtt-bridge` is a single always-on Node process (Fastify + mqtt.js) that maintains those connections and the in-memory `DeviceRegistry`. It runs on the `internal` Docker network only and is **never exposed through Traefik** (see [architecture.md](architecture.md#infrastructure)).

## Connections it maintains

| Connection | Purpose |
|---|---|
| Mosquitto (MQTT) | LUMI device frames (via `LumiClient`) **and** Zigbee2MQTT topics |
| Hue Bridge (REST v2) | Philips Hue bulb control + reachability polling |
| PostgreSQL (Prisma) | Read device rows at startup; write state/reachability on every event |

## Library wiring

At startup the service constructs the `bridge/node` modules and loads the registry from the DB:

```typescript
const mqttClient = mqtt.connect(MQTT_URL)
const client     = new LumiClient(mqttClient, new LumiCodec())
const registry   = new DeviceRegistry()

// Hydrate the in-memory registry from PostgreSQL
for (const d of await db.listLumiDevices()) registry.upsert(d.externalId, d)

client.on('discovery',    (dev)            => { registry.upsert(dev.deviceId, dev); db.upsertDevice(dev) })
client.on('availability', (deviceId, on)   => { registry.setReachable(deviceId, on); db.setReachable(deviceId, on) })
client.on('state_report', (deviceId, st)   => db.updateDeviceState(deviceId, st))
```

`DeviceRegistry` is the in-memory catalogue; PostgreSQL is the source of truth. The service delegates persistence to the DB and uses the registry for fast routing (which protocol/version a `deviceId` speaks).

---

## Internal HTTP API (Next.js → bridge)

Per-device commands only. **Scene fan-out and trigger logic live in Next.js** — Next reads the `SceneDevice` rows and calls these endpoints once per device. The bridge stays a pure protocol router and never reads scene/trigger tables.

| Method | Path | Description |
|---|---|---|
| `POST` | `/command/:deviceId` | Send a light command. Body matches the [api.md command shape](api.md#devices). |
| `POST` | `/zone/:deviceId` | LUMI only — send `SET_ZONE`. Body `{ "zone": 2 }`. |
| `POST` | `/discover` | Broadcast `DISCOVERY_REQUEST` to all LUMI devices. |
| `GET` | `/health` | Liveness — broker + Hue + DB reachable. |

- **Trust boundary**: the API is reachable only from the `app` container on the `internal` network. A shared secret (`BRIDGE_TOKEN` header) guards it in case the network is ever widened.
- **Command flow**: the handler routes by the device's protocol —
  - `LUMI` → `LumiClient.setPower / setBrightness / setColor / setAnimation / stopAnimation`, awaits the ACK (5 s).
  - `HUE` → HTTP call to the Hue Bridge REST v2.
  - `ZIGBEE` → sensors are read-only; a command on a `SENSOR` is rejected `422`.
- **Response**: `200` once delivery is confirmed (LUMI ACK / Hue `2xx`), `502` on timeout or protocol error. Next.js maps a successful delivery to `202 Accepted` for the browser — the *resulting* device state is confirmed separately over SSE, not in this response (see [Real-time](#real-time-state-back-to-the-browser)).

---

## State path (device → DB → browser)

Every inbound device event is written to PostgreSQL, the single source of truth:

| Event | Source | Written to |
|---|---|---|
| `STATE_REPORT` | LUMI device (via `LumiClient`) | `Device` light columns |
| `availability` | LUMI LWT topic | `Device.reachable` |
| Zigbee2MQTT message | z2m topic | `Device.sensorActive` / `reachable` |
| Hue event / poll | Hue Bridge | `Device` light columns / `reachable` |
| `DISCOVERY_ANNOUNCE` | LUMI device | upsert `Device` (incl. `zone`, `protoVersion`) |

### Animation parameters

`STATE_REPORT` reports `animId` but **not** the `speed` / `intensity` that were sent with `SET_ANIMATION` (a v1 protocol constraint — see [lumi-protocol api.md](https://github.com/dejarn/lumi-protocol/blob/main/docs/api.md)). The bridge owns those values when it issues the command, so it persists them itself when writing the resulting state. Next.js reads them back from the DB; they are not recovered from the device.

### Reachability

Written from the availability/availability-equivalent channel of each protocol only — `lumi/device/+/availability` (LUMI LWT), Zigbee2MQTT availability, Hue REST `reachable`. **ACK timeouts never touch `reachable`** (a busy device is not an offline one). Full matrix in [architecture.md](architecture.md#device-reachability).

---

## Real-time (state back to the browser)

The browser's live updates come from the Next.js SSE handler (`GET /api/stream`), not from the bridge directly. The two are decoupled through PostgreSQL using **LISTEN/NOTIFY**:

```
bridge: write Device row  ──►  NOTIFY device_state, '<deviceId>'
                                        │
Next.js SSE handler: LISTEN device_state
                                        │
        on notify → read the Device row → push `device-state` SSE event
```

- The bridge issues a `NOTIFY device_state, '<deviceId>'` after each state/reachability write.
- The SSE Route Handler holds a dedicated PG connection doing `LISTEN device_state`; on each notification it reads the row and pushes the patch to connected clients (payload shape in [api.md](api.md#stream-sse)).
- No polling, no extra pub/sub service, no direct bridge→Next coupling — Postgres is the rendez-vous point.

---

## Startup & resilience

- **Boot**: connect MQTT + Hue, hydrate `DeviceRegistry` from PostgreSQL, subscribe to `lumi/device/+/state`, `lumi/device/+/availability`, `lumi/discovery/announce`, and the Zigbee2MQTT topics.
- **MQTT drop**: mqtt.js auto-reconnects; retained `availability` + `state` topics mean the registry re-syncs to the last known device states on resubscribe.
- **Best-effort**: like triggers, command delivery is best-effort. A failed command rejects its own request; it does not retry indefinitely or block others. Partial scene failures are tolerated (one unreachable light does not abort the rest).

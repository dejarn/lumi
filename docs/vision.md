# Vision

_Last updated: 2026-05-20_

Lumi is a self-hosted home automation platform running on a Raspberry Pi. It gives residents of a shared apartment manual and automated control over connected lighting via a mobile-first web interface. Built from scratch — no cloud dependency, no Home Assistant.

## Problem

Off-the-shelf solutions (Home Assistant, Google Home) are either too complex to own, cloud-dependent, or impose their UX. The apartment already has Philips Hue bulbs, Zigbee sensors, and custom LED strips on ESP32 boards. Lumi ties them together under a single interface with the exact experience we want.

## Out of scope

- Voice control
- Thermostat, blinds, or alarm integration
- External cloud services (Alexa, Google Home, Philips cloud)
- Multi-home or multi-apartment support
- Home Assistant (one instance = one apartment)

## Core concepts

| Concept | Definition |
|---|---|
| **Device** | A controllable unit registered in the system. Can be a light source (Hue bulb, ESP32 LED strip) or a sensor (Zigbee presence detector). |
| **Scene** | A named snapshot of device states activatable in a single action. Spans any combination of devices regardless of their protocol. |
| **Trigger** | A condition linked to a scene — either a cron schedule or a sensor event (e.g. presence detected). When the condition fires, the scene activates automatically. |
| **Zone** | A hardware grouping for ESP32 devices, stored on the device itself. Used for MQTT routing. Distinct from scenes — zones are physical, scenes are logical. |

## Roles

| Role | Scope |
|---|---|
| **Admin** | Full access: device registration, scene and trigger management, user management. |
| **User** | Can activate scenes and control devices. Cannot register new devices or manage users. |

## Major views

1. **Dashboard** — Grid of device tiles. Toggle, dim, and color-pick individual devices. Primary daily-use view.
2. **Scenes** — Create, edit, and activate scenes. Selecting a scene sets all linked devices to their saved state simultaneously.
3. **Triggers** — Link scenes to schedules or sensor events. Enable/disable without deleting.
4. **Admin — Devices** — Register devices, assign names and zones, remove stale devices.

## Device protocols

Lumi integrates three protocols transparently — users never interact with the protocol layer.

| Protocol | Devices | Integration |
|---|---|---|
| Zigbee (proprietary) | Philips Hue bulbs | Hue local API v2 via Hue Bridge |
| Zigbee (open) | Presence sensors | Zigbee2MQTT via USB coordinator dongle |
| Wi-Fi / MQTT | Custom ESP32 LED strips | lumi-protocol (binary over MQTT) |

## Accepted trade-offs

- The Hue Bridge is kept as a dependency in v1 — bulbs are not re-paired to the open Zigbee coordinator. This simplifies onboarding at the cost of a proprietary hardware dependency.
- The Raspberry Pi runs on Wi-Fi. If the network drops, automation stops. Accepted given apartment constraints.
- next-auth v5 is used in its beta release, pinned to match the reference project (cadanse). Breaking changes are a known risk.
- Trigger reliability is best-effort: if the Pi is unreachable at fire time, the trigger is skipped silently. No retry queue in v1.

"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import type { DeviceStatePatch } from "@/lib/types"

// One global EventSource per session against /api/stream. Every device tile reads
// the latest patch from this context — no polling, no full reload (docs/frontend.md).

type DeviceStateMap = Record<string, DeviceStatePatch>

type SseValue = { states: DeviceStateMap; connected: boolean }

const SseContext = createContext<SseValue>({ states: {}, connected: false })

export function useDeviceState(deviceId: string): DeviceStatePatch | undefined {
  return useContext(SseContext).states[deviceId]
}

/** Full live-state map — for aggregate reads (e.g. offline count). */
export function useDeviceStates(): DeviceStateMap {
  return useContext(SseContext).states
}

/** True once the stream has opened — drives the first-sync skeleton (docs/design.md). */
export function useSseConnected(): boolean {
  return useContext(SseContext).connected
}

export default function SseProvider({ children }: { children: React.ReactNode }) {
  const [states, setStates] = useState<DeviceStateMap>({})
  const [connected, setConnected] = useState(false)
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const source = new EventSource("/api/stream")
    sourceRef.current = source

    source.addEventListener("open", () => setConnected(true))

    source.addEventListener("device-state", (event) => {
      try {
        const patch = JSON.parse((event as MessageEvent).data) as DeviceStatePatch
        setStates((prev) => ({ ...prev, [patch.deviceId]: { ...prev[patch.deviceId], ...patch } }))
      } catch {
        // ignore malformed frames
      }
    })

    return () => {
      source.close()
      sourceRef.current = null
    }
  }, [])

  return <SseContext.Provider value={{ states, connected }}>{children}</SseContext.Provider>
}

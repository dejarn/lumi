"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { DeviceStatePatch } from "@/lib/types"

type DeviceStateMap = Record<string, DeviceStatePatch>

type SseValue = {
  states: DeviceStateMap
  connected: boolean
  error: boolean
  reconnect: () => void
}

const SseContext = createContext<SseValue>({
  states: {},
  connected: false,
  error: false,
  reconnect: () => {},
})

export function useDeviceState(deviceId: string): DeviceStatePatch | undefined {
  return useContext(SseContext).states[deviceId]
}

export function useDeviceStates(): DeviceStateMap {
  return useContext(SseContext).states
}

export function useSseConnected(): boolean {
  return useContext(SseContext).connected
}

export function useSseError(): boolean {
  return useContext(SseContext).error
}

export function useSseReconnect(): () => void {
  return useContext(SseContext).reconnect
}

export default function SseProvider({ children }: { children: React.ReactNode }) {
  const [states, setStates] = useState<DeviceStateMap>({})
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState(false)
  const sourceRef = useRef<EventSource | null>(null)
  const retryRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const connectRef = useRef<() => void>(() => {})

  const connect = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    sourceRef.current?.close()

    const source = new EventSource("/api/stream")
    sourceRef.current = source

    source.addEventListener("open", () => {
      setConnected(true)
      setError(false)
      retryRef.current = 0
    })

    source.addEventListener("device-state", (event) => {
      try {
        const patch = JSON.parse((event as MessageEvent).data) as DeviceStatePatch
        setStates((prev) => ({ ...prev, [patch.deviceId]: { ...prev[patch.deviceId], ...patch } }))
      } catch {
        // ignore malformed frames
      }
    })

    source.addEventListener("error", () => {
      if (source.readyState === EventSource.CLOSED) {
        setConnected(false)
        setError(true)
        source.close()
        sourceRef.current = null
        const delay = Math.min(1000 * 2 ** retryRef.current, 30_000)
        retryRef.current += 1
        retryTimerRef.current = setTimeout(() => connectRef.current(), delay)
      }
    })
  }, [])

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  useEffect(() => {
    connect()
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      sourceRef.current?.close()
      sourceRef.current = null
    }
  }, [connect])

  const value = useMemo(
    () => ({ states, connected, error, reconnect: connect }),
    [states, connected, error, connect],
  )

  return <SseContext.Provider value={value}>{children}</SseContext.Provider>
}

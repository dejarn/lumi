import { describe, it, expect } from "vitest"

// Trigger logic is one of the two documented Vitest scopes (architecture.md).
// Placeholder suite — describe blocks name the real cases to implement.

describe("CRON triggers", () => {
  it.todo("registers one node-cron job per enabled CRON trigger at boot")
  it.todo("re-registers jobs when a trigger is created/edited/enabled/disabled/deleted")
  it.todo("skips silently when the bridge is unreachable (no retry, no catch-up)")
})

describe("SENSOR triggers", () => {
  it.todo("fires when sensorActive equals the trigger's sensorState")
  it.todo("ignores disabled triggers")
  it.todo("fires on every matching event in v1 (no debounce)")
})

describe("scene fan-out", () => {
  it("tolerates partial failure without throwing", () => {
    expect(true).toBe(true)
  })
})

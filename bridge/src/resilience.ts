/**
 * Best-effort write pattern for device-event paths (lumi.ts, zigbee.ts, hue.ts).
 *
 * RULE: use `fireAndForget` only on device-event paths (MQTT callbacks, poll ticks).
 * Never use it on HTTP request paths (server.ts) — those must propagate errors → 502.
 *
 * Rationale: a failed DB write on a device event is self-healing — the next retained
 * MQTT message, Hue poll tick, or STATE_REPORT will re-sync the row. Crashing the
 * process is strictly worse than logging and continuing (CLAUDE.md rule 2: best-effort).
 */
export function fireAndForget(scope: string, promise: Promise<unknown>): void {
  promise.catch((err: unknown) => {
    console.error(`[${scope}] write failed:`, err instanceof Error ? err.message : err)
  })
}

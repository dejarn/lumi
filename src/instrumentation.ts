// Next.js calls register() once when the server process boots. We start the
// automation scheduler here so CRON/SENSOR triggers run in the long-lived Node
// process, not in request-scoped handlers (docs/automation.md, CLAUDE.md rule 6).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("@/lib/automation/scheduler")
    await startScheduler()
  }
}

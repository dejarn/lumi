import { describe, it, expect } from "vitest"
import { buildCron, parseCron, cronToHuman, type CronParts } from "./cron-human"

const CRON_EXPR_PATTERN = /^(\S+\s+){4}\S+$/

describe("buildCron", () => {
  it("builds weekday expression", () => {
    expect(buildCron({ hour: 7, minute: 0, days: [1, 2, 3, 4, 5] })).toBe(
      "0 7 * * 1,2,3,4,5",
    )
  })

  it("sorts and deduplicates days", () => {
    expect(buildCron({ hour: 9, minute: 30, days: [5, 1, 3, 1] })).toBe(
      "30 9 * * 1,3,5",
    )
  })

  it('uses * for days "all"', () => {
    expect(buildCron({ hour: 22, minute: 0, days: "all" })).toBe("0 22 * * *")
  })

  it("always produces a 5-field expression matching CRON_EXPR_PATTERN", () => {
    const cases: CronParts[] = [
      { hour: 0, minute: 0, days: "all" },
      { hour: 23, minute: 59, days: [0, 6] },
      { hour: 12, minute: 15, days: [2, 4] },
    ]
    for (const parts of cases) {
      const expr = buildCron(parts)
      expect(CRON_EXPR_PATTERN.test(expr)).toBe(true)
      expect(expr.split(/\s+/)).toHaveLength(5)
    }
  })

  it("throws on empty days array", () => {
    expect(() => buildCron({ hour: 7, minute: 0, days: [] })).toThrow(
      "days must be 'all' or a non-empty array",
    )
  })
})

describe("parseCron", () => {
  it("parses comma-separated days", () => {
    expect(parseCron("30 9 * * 0,6")).toEqual({
      hour: 9,
      minute: 30,
      days: [0, 6],
    })
  })

  it("normalizes day ranges", () => {
    expect(parseCron("0 7 * * 1-5")).toEqual({
      hour: 7,
      minute: 0,
      days: [1, 2, 3, 4, 5],
    })
  })

  it('parses days "*" as all', () => {
    expect(parseCron("0 22 * * *")).toEqual({
      hour: 22,
      minute: 0,
      days: "all",
    })
  })

  it("rejects day-of-month other than *", () => {
    expect(parseCron("0 7 1 * *")).toBeNull()
  })

  it("rejects month other than *", () => {
    expect(parseCron("0 7 * 1 *")).toBeNull()
  })

  it("rejects step expressions", () => {
    expect(parseCron("*/15 * * * *")).toBeNull()
  })

  it("rejects wrong field count", () => {
    expect(parseCron("0 7 * *")).toBeNull()
  })
})

describe("buildCron ↔ parseCron round-trip", () => {
  const cases: CronParts[] = [
    { hour: 7, minute: 0, days: [1, 2, 3, 4, 5] },
    { hour: 9, minute: 30, days: [0, 6] },
    { hour: 22, minute: 0, days: "all" },
    { hour: 14, minute: 5, days: [3] },
    { hour: 0, minute: 0, days: [1, 3, 5] },
  ]

  it.each(cases)("round-trips %#", (parts) => {
    const expr = buildCron(parts)
    const parsed = parseCron(expr)
    expect(parsed).toEqual(normalizeParts(parts))
  })
})

function normalizeParts(parts: CronParts): CronParts {
  if (parts.days === "all") return parts
  return {
    ...parts,
    days: [...new Set(parts.days)].sort((a, b) => a - b),
  }
}

describe("cronToHuman", () => {
  it("formats weekdays in French", () => {
    expect(cronToHuman("0 7 * * 1,2,3,4,5")).toBe("Du lundi au vendredi à 7h")
  })

  it("formats every day", () => {
    expect(cronToHuman("0 22 * * *")).toBe("Tous les jours à 22h")
  })

  it("formats weekend", () => {
    expect(cronToHuman("30 9 * * 0,6")).toBe("Le week-end à 9h30")
  })

  it("formats a single day", () => {
    expect(cronToHuman("0 8 * * 1")).toBe("Le lundi à 8h")
  })

  it("formats arbitrary day lists with abbreviations", () => {
    expect(cronToHuman("0 18 * * 1,3,5")).toBe("Lun, Mer, Ven à 18h")
  })

  it("normalizes ranges before humanizing", () => {
    expect(cronToHuman("0 7 * * 1-5")).toBe("Du lundi au vendredi à 7h")
  })

  it("falls back to raw expression when parse fails", () => {
    expect(cronToHuman("0 7 1 * *")).toBe("Horaire : 0 7 1 * *")
    expect(cronToHuman("*/15 * * * *")).toBe("Horaire : */15 * * * *")
  })
})

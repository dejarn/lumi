// Weekday convention matches node-cron: 0 = Sunday … 6 = Saturday.

export type CronDays = number[] | "all"

export interface CronParts {
  hour: number // 0–23
  minute: number // 0–59
  days: CronDays
}

const CRON_EXPR_PATTERN = /^(\S+\s+){4}\S+$/

const DAY_NAMES = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
] as const

const DAY_ABBR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"] as const

const WEEKDAYS: number[] = [1, 2, 3, 4, 5]
const WEEKEND: number[] = [0, 6]

function parseSimpleInt(field: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(field)) return null
  const n = Number(field)
  if (n < min || n > max) return null
  return n
}

function sortedUnique(days: number[]): number[] {
  return [...new Set(days)].sort((a, b) => a - b)
}

function arraysEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

function parseDaysField(field: string): CronDays | null {
  if (field === "*") return "all"
  if (field.includes("/")) return null

  const days: number[] = []

  for (const token of field.split(",")) {
    if (token === "") return null

    if (token.includes("-")) {
      const [startStr, endStr, ...rest] = token.split("-")
      if (rest.length > 0) return null
      const start = parseSimpleInt(startStr, 0, 6)
      const end = parseSimpleInt(endStr, 0, 6)
      if (start === null || end === null || start > end) return null
      for (let d = start; d <= end; d++) days.push(d)
    } else {
      const d = parseSimpleInt(token, 0, 6)
      if (d === null) return null
      days.push(d)
    }
  }

  if (days.length === 0) return null
  return sortedUnique(days)
}

function formatDaysField(days: CronDays): string {
  if (days === "all") return "*"
  return sortedUnique(days).join(",")
}

function formatTime(hour: number, minute: number): string {
  if (minute === 0) return `${hour}h`
  return `${hour}h${minute.toString().padStart(2, "0")}`
}

function formatDaysHuman(days: CronDays): string {
  if (days === "all") return "Tous les jours"

  const sorted = sortedUnique(days)

  if (arraysEqual(sorted, WEEKEND)) return "Le week-end"
  if (arraysEqual(sorted, WEEKDAYS)) return "Du lundi au vendredi"

  if (sorted.length === 1) {
    return `Le ${DAY_NAMES[sorted[0]]}`
  }

  return sorted.map((d) => DAY_ABBR[d]).join(", ")
}

export function buildCron(parts: CronParts): string {
  const { hour, minute, days } = parts

  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error("hour must be an integer between 0 and 23")
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error("minute must be an integer between 0 and 59")
  }
  if (days !== "all") {
    if (!Array.isArray(days) || days.length === 0) {
      throw new Error("days must be 'all' or a non-empty array of weekday numbers (0–6)")
    }
    for (const d of days) {
      if (!Number.isInteger(d) || d < 0 || d > 6) {
        throw new Error("each day must be an integer between 0 and 6")
      }
    }
  }

  const expr = `${minute} ${hour} * * ${formatDaysField(days)}`

  if (!CRON_EXPR_PATTERN.test(expr)) {
    throw new Error(`invalid cron expression produced: ${expr}`)
  }

  return expr
}

export function parseCron(expr: string): CronParts | null {
  const trimmed = expr.trim()
  const fields = trimmed.split(/\s+/)
  if (fields.length !== 5) return null

  const [minuteField, hourField, domField, monthField, daysField] = fields

  if (domField !== "*" || monthField !== "*") return null
  if (minuteField.includes("/") || hourField.includes("/")) return null

  const minute = parseSimpleInt(minuteField, 0, 59)
  const hour = parseSimpleInt(hourField, 0, 23)
  if (minute === null || hour === null) return null

  const days = parseDaysField(daysField)
  if (days === null) return null

  return { hour, minute, days }
}

export function cronToHuman(expr: string): string {
  const parts = parseCron(expr)
  if (parts === null) return `Horaire : ${expr.trim()}`

  return `${formatDaysHuman(parts.days)} à ${formatTime(parts.hour, parts.minute)}`
}

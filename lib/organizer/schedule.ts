import { z } from "zod"

export const ROSTER_LIMIT = 4

/** Per-lane visual tokens — distinct hues that stay readable in light/dark. */
export const LANE_STYLES = [
  {
    solid: "bg-[oklch(0.62_0.14_230)]",
    soft: "bg-[oklch(0.62_0.14_230)]/20",
    draft: "bg-[oklch(0.62_0.14_230)]/45 ring-2 ring-[oklch(0.62_0.14_230)]/70",
    clear: "bg-[oklch(0.62_0.14_230)]/25 ring-2 ring-dashed ring-[oklch(0.45_0.08_230)]",
    chip: "bg-[oklch(0.62_0.14_230)] text-white",
    dot: "bg-[oklch(0.62_0.14_230)]",
  },
  {
    solid: "bg-[oklch(0.64_0.15_155)]",
    soft: "bg-[oklch(0.64_0.15_155)]/20",
    draft: "bg-[oklch(0.64_0.15_155)]/45 ring-2 ring-[oklch(0.64_0.15_155)]/70",
    clear: "bg-[oklch(0.64_0.15_155)]/25 ring-2 ring-dashed ring-[oklch(0.45_0.08_155)]",
    chip: "bg-[oklch(0.64_0.15_155)] text-white",
    dot: "bg-[oklch(0.64_0.15_155)]",
  },
  {
    solid: "bg-[oklch(0.66_0.14_45)]",
    soft: "bg-[oklch(0.66_0.14_45)]/20",
    draft: "bg-[oklch(0.66_0.14_45)]/45 ring-2 ring-[oklch(0.66_0.14_45)]/70",
    clear: "bg-[oklch(0.66_0.14_45)]/25 ring-2 ring-dashed ring-[oklch(0.5_0.1_45)]",
    chip: "bg-[oklch(0.66_0.14_45)] text-white",
    dot: "bg-[oklch(0.66_0.14_45)]",
  },
  {
    solid: "bg-[oklch(0.58_0.12_20)]",
    soft: "bg-[oklch(0.58_0.12_20)]/20",
    draft: "bg-[oklch(0.58_0.12_20)]/45 ring-2 ring-[oklch(0.58_0.12_20)]/70",
    clear: "bg-[oklch(0.58_0.12_20)]/25 ring-2 ring-dashed ring-[oklch(0.45_0.08_20)]",
    chip: "bg-[oklch(0.58_0.12_20)] text-white",
    dot: "bg-[oklch(0.58_0.12_20)]",
  },
] as const

/** @deprecated Use LANE_STYLES — kept for any stray imports during transition */
export const LANE_COLORS = LANE_STYLES.map((s) => s.solid)
export const LANE_HOVER_COLORS = LANE_STYLES.map((s) => s.soft)
export const LANE_DRAFT_COLORS = LANE_STYLES.map((s) => s.draft)

export type SchedulePerson = {
  id: string
  email: string
  displayName: string
  laneIndex: number
}

export type WorkSlotRow = {
  id: string
  user_id: string
  starts_at: string
  created_at: string
}

export const schedulePostBodySchema = z.object({
  startsAt: z.array(z.string().datetime({ offset: true })).min(1).max(24),
  mode: z.enum(["set", "clear"]),
})

export type SchedulePostBody = z.infer<typeof schedulePostBodySchema>

/** Slot is locked when its start is more than 48 hours in the past. */
export function isSlotLocked(startsAt: Date, now = new Date()): boolean {
  return startsAt.getTime() <= now.getTime() - 48 * 60 * 60 * 1000
}

export function floorToLocalHour(date: Date): Date {
  const d = new Date(date)
  d.setMinutes(0, 0, 0)
  return d
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000)
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** Eight days: day before anchor through +6 after anchor. offsetDays shifts the window. */
export function getVisibleDays(now = new Date(), offsetDays = 0): Date[] {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const start = addDays(today, -1 + offsetDays)
  return Array.from({ length: 8 }, (_, i) => addDays(start, i))
}

export function formatRangeLabel(from: Date, to: Date): string {
  const sameYear = from.getFullYear() === to.getFullYear()
  const start = from.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })
  const end = to.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  return `${start} – ${end}`
}

export function getDayHours(day: Date): Date[] {
  const start = new Date(day)
  start.setHours(0, 0, 0, 0)
  return Array.from({ length: 24 }, (_, h) => addHours(start, h))
}

export function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function hoursBetweenInclusive(a: Date, b: Date): Date[] {
  const start = a.getTime() <= b.getTime() ? a : b
  const end = a.getTime() <= b.getTime() ? b : a
  const hours =
    Math.round((end.getTime() - start.getTime()) / (60 * 60 * 1000)) + 1
  return Array.from({ length: hours }, (_, i) => addHours(start, i))
}

export function formatHourLabel(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

export function formatDayHeader(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

export function getInitials(displayName: string, email: string): string {
  const source = displayName.trim() || email.trim()
  if (!source) return "?"
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  }
  return source.slice(0, 2).toUpperCase()
}

export function displayNameFromUser(user: {
  email?: string | null
  user_metadata?: Record<string, unknown> | null
}): string {
  const meta = user.user_metadata ?? {}
  const name =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.display_name === "string" && meta.display_name) ||
    ""
  if (name.trim()) return name.trim()
  const email = user.email ?? ""
  return email.split("@")[0] || email || "User"
}

export function slotKey(userId: string, startsAtIso: string): string {
  return `${userId}:${startsAtIso}`
}

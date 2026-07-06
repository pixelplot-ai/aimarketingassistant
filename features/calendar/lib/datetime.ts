import {
  addDays,
  addHours,
  addMinutes,
  nextMonday,
  setHours,
  setMinutes,
} from "date-fns"
import { formatInTimeZone, fromZonedTime } from "date-fns-tz"

export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) {
    return ""
  }

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

export function fromDatetimeLocalValue(value: string): string | null {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

export function toTimeInputValue(
  iso: string | null | undefined,
  timezone = "UTC",
): string {
  if (!iso) {
    return "09:00"
  }

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return "09:00"
  }

  return formatInTimeZone(date, timezone, "HH:mm")
}

export function formatScheduleDisplay(
  iso: string,
  timezone = "UTC",
): string {
  return formatInTimeZone(iso, timezone, "EEE, MMM d, yyyy · h:mm a")
}

export function mergeScheduleValue(
  nextDate: Date,
  timeValue: string,
  timezone = "UTC",
): string {
  const datePart = formatInTimeZone(nextDate, timezone, "yyyy-MM-dd")
  const zonedDateTime = `${datePart}T${timeValue}:00`
  return fromZonedTime(zonedDateTime, timezone).toISOString()
}

export type SchedulePreset = {
  id: string
  label: string
  getValue: (timezone: string) => Date
}

export const SCHEDULE_PRESETS: SchedulePreset[] = [
  {
    id: "1h",
    label: "In 1 hour",
    getValue: () => addHours(new Date(), 1),
  },
  {
    id: "30m",
    label: "In 30 min",
    getValue: () => addMinutes(new Date(), 30),
  },
  {
    id: "tomorrow-9",
    label: "Tomorrow 9 AM",
    getValue: (timezone) =>
      fromZonedTime(
        `${formatInTimeZone(addDays(new Date(), 1), timezone, "yyyy-MM-dd")}T09:00:00`,
        timezone,
      ),
  },
  {
    id: "tomorrow-12",
    label: "Tomorrow 12 PM",
    getValue: (timezone) =>
      fromZonedTime(
        `${formatInTimeZone(addDays(new Date(), 1), timezone, "yyyy-MM-dd")}T12:00:00`,
        timezone,
      ),
  },
  {
    id: "monday-10",
    label: "Next Mon 10 AM",
    getValue: (timezone) =>
      fromZonedTime(
        `${formatInTimeZone(nextMonday(new Date()), timezone, "yyyy-MM-dd")}T10:00:00`,
        timezone,
      ),
  },
]

export const QUICK_TIMES = ["09:00", "12:00", "15:00", "18:00"] as const

/** @deprecated Legacy helper — uses browser local time. Prefer mergeScheduleValue with timezone. */
export function combineDateAndTime(date: Date, timeValue: string): Date {
  const [hours, minutes] = timeValue.split(":").map(Number)
  return setMinutes(setHours(date, hours ?? 0), minutes ?? 0)
}

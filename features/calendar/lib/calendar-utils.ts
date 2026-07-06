import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns"

import type { CalendarPost } from "@/features/calendar/queries"

export function parseMonthParam(value: string | undefined): Date {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    return startOfMonth(new Date())
  }

  const parsed = parseISO(`${value}-01`)
  if (Number.isNaN(parsed.getTime())) {
    return startOfMonth(new Date())
  }

  return parsed
}

export function formatMonthParam(date: Date): string {
  return format(date, "yyyy-MM")
}

export function parseDateParam(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }

  const parsed = parseISO(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatDateParam(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

export function getCalendarGrid(referenceMonth: Date) {
  const monthStart = startOfMonth(referenceMonth)
  const monthEnd = endOfMonth(referenceMonth)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  return { monthStart, monthEnd, gridStart, gridEnd, days }
}

export function groupPostsByDay(
  posts: CalendarPost[],
): Map<string, CalendarPost[]> {
  const map = new Map<string, CalendarPost[]>()

  for (const post of posts) {
    if (!post.scheduled_at) {
      continue
    }

    const key = format(new Date(post.scheduled_at), "yyyy-MM-dd")
    const existing = map.get(key) ?? []
    existing.push(post)
    map.set(key, existing)
  }

  for (const [key, dayPosts] of map) {
    dayPosts.sort(
      (a, b) =>
        new Date(a.scheduled_at!).getTime() -
        new Date(b.scheduled_at!).getTime(),
    )
    map.set(key, dayPosts)
  }

  return map
}

export function getDefaultSelectedDate(
  referenceMonth: Date,
  dateParam: Date | null,
  postsByDay: Map<string, CalendarPost[]>,
): Date {
  if (dateParam && isSameMonth(dateParam, referenceMonth)) {
    return dateParam
  }

  const today = new Date()
  if (isSameMonth(today, referenceMonth)) {
    return today
  }

  const firstDayWithPosts = [...postsByDay.keys()]
    .sort()
    .find((key) => key.startsWith(format(referenceMonth, "yyyy-MM")))

  if (firstDayWithPosts) {
    return parseISO(firstDayWithPosts)
  }

  return startOfMonth(referenceMonth)
}

export { isSameDay, isSameMonth, isToday }

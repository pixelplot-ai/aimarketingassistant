import type { Enums } from "@/types/database"

export const POST_STATUSES: Enums<"post_status">[] = [
  "draft",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "cancelled",
]

export function getPostStatusVariant(
  status: Enums<"post_status">,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "published":
      return "default"
    case "scheduled":
    case "publishing":
      return "secondary"
    case "failed":
    case "cancelled":
      return "destructive"
    default:
      return "outline"
  }
}

export function getPostStatusStyles(status: Enums<"post_status">): {
  badge: string
  dot: string
} {
  switch (status) {
    case "published":
      return {
        badge:
          "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        dot: "bg-emerald-500",
      }
    case "scheduled":
      return {
        badge:
          "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-400",
        dot: "bg-sky-500",
      }
    case "publishing":
      return {
        badge:
          "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        dot: "bg-amber-500 animate-pulse",
      }
    case "failed":
      return {
        badge:
          "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-400",
        dot: "bg-red-500",
      }
    case "cancelled":
      return {
        badge:
          "border-border bg-muted/60 text-muted-foreground",
        dot: "bg-muted-foreground/60",
      }
    case "draft":
    default:
      return {
        badge:
          "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-400",
        dot: "bg-slate-400",
      }
  }
}

export function formatPostStatus(status: Enums<"post_status">): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

const APP_MANAGED_STATUSES: Enums<"post_status">[] = [
  "published",
  "publishing",
  "failed",
]

export function canSchedulePost(values: {
  content: string
  platform_ids: string[]
  scheduled_at?: string | null
}): boolean {
  if (!values.scheduled_at?.trim()) {
    return false
  }

  if (values.content.trim().length === 0) {
    return false
  }

  if (values.platform_ids.length === 0) {
    return false
  }

  const scheduledDate = new Date(values.scheduled_at)
  return (
    !Number.isNaN(scheduledDate.getTime()) && scheduledDate.getTime() > Date.now()
  )
}

/** Draft if no future date; scheduled if future date is set. App-managed statuses are preserved on save. */
export function resolvePostStatusFromSchedule(
  scheduledAt: string | null | undefined,
  currentStatus?: Enums<"post_status">,
): Enums<"post_status"> {
  if (currentStatus && APP_MANAGED_STATUSES.includes(currentStatus)) {
    return currentStatus
  }

  if (scheduledAt) {
    const scheduledDate = new Date(scheduledAt)
    if (
      !Number.isNaN(scheduledDate.getTime()) &&
      scheduledDate > new Date()
    ) {
      return "scheduled"
    }
  }

  return "draft"
}

export function previewSaveStatus(
  scheduledAt: string | null | undefined,
  currentStatus?: Enums<"post_status">,
): Enums<"post_status"> {
  return resolvePostStatusFromSchedule(scheduledAt, currentStatus)
}

export const COMMON_EMOJIS = [
  "😀",
  "😂",
  "😍",
  "🔥",
  "👍",
  "🎉",
  "✨",
  "💡",
  "📣",
  "🚀",
  "❤️",
  "💯",
  "👀",
  "🙌",
  "💪",
  "📸",
  "🎬",
  "📝",
  "🔗",
  "⭐",
]

export const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Bucharest",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
]

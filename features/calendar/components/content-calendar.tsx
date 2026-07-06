"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  subMonths,
} from "date-fns"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PostStatusBadge } from "@/features/posts/components/post-status-badge"
import { PlatformChip } from "@/features/platforms/platform-icons"
import {
  formatDateParam,
  formatMonthParam,
  getCalendarGrid,
  groupPostsByDay,
} from "@/features/calendar/lib/calendar-utils"
import type { CalendarPost } from "@/features/calendar/queries"
import { cn } from "@/lib/utils"

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const STATUS_LEGEND = [
  { status: "scheduled" as const, label: "Scheduled" },
  { status: "published" as const, label: "Published" },
  { status: "publishing" as const, label: "Publishing" },
  { status: "failed" as const, label: "Failed" },
]

function getPostBarClass(status: CalendarPost["status"]): string {
  switch (status) {
    case "scheduled":
      return "border-sky-500/20 bg-sky-500/10 text-sky-800 dark:text-sky-300"
    case "published":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
    case "publishing":
      return "border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-300"
    case "failed":
      return "border-red-500/20 bg-red-500/10 text-red-800 dark:text-red-300"
    default:
      return "border-border bg-muted/60 text-foreground"
  }
}

interface ContentCalendarProps {
  posts: CalendarPost[]
  month: Date
  selectedDate: Date
}

export function ContentCalendar({
  posts,
  month,
  selectedDate: initialSelectedDate,
}: ContentCalendarProps) {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate)

  const { days } = useMemo(() => getCalendarGrid(month), [month])
  const postsByDay = useMemo(() => groupPostsByDay(posts), [posts])

  const selectedDayPosts =
    postsByDay.get(format(selectedDate, "yyyy-MM-dd")) ?? []

  function navigateMonth(nextMonth: Date) {
    router.push(
      `/calendar?month=${formatMonthParam(nextMonth)}&date=${formatDateParam(selectedDate)}`,
    )
  }

  function selectDay(day: Date) {
    setSelectedDate(day)
    router.push(
      `/calendar?month=${formatMonthParam(month)}&date=${formatDateParam(day)}`,
      { scroll: false },
    )
  }

  function goToday() {
    const today = new Date()
    router.push(
      `/calendar?month=${formatMonthParam(today)}&date=${formatDateParam(today)}`,
    )
    setSelectedDate(today)
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b bg-muted/20 pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="size-5 text-sky-600 dark:text-sky-400" />
                {format(month, "MMMM yyyy")}
              </CardTitle>
              <CardDescription>
                {posts.length} scheduled item{posts.length === 1 ? "" : "s"} this
                period
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={goToday}>
                Today
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Previous month"
                onClick={() => navigateMonth(subMonths(month, 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Next month"
                onClick={() => navigateMonth(addMonths(month, 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
              <Button
                nativeButton={false}
                size="sm"
                render={<Link href="/posts/new" />}
              >
                <Plus className="size-4" />
                New post
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-3">
            {STATUS_LEGEND.map((item) => (
              <div
                key={item.status}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span
                  className={cn(
                    "size-2 rounded-full",
                    item.status === "scheduled" && "bg-sky-500",
                    item.status === "published" && "bg-emerald-500",
                    item.status === "publishing" && "bg-amber-500 animate-pulse",
                    item.status === "failed" && "bg-red-500",
                  )}
                />
                {item.label}
              </div>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b bg-muted/30">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="border-r px-2 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground last:border-r-0"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((day) => {
              const dayKey = format(day, "yyyy-MM-dd")
              const dayPosts = postsByDay.get(dayKey) ?? []
              const inMonth = isSameMonth(day, month)
              const selected = isSameDay(day, selectedDate)
              const today = isToday(day)

              return (
                <button
                  key={dayKey}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={cn(
                    "group relative min-h-[7.5rem] border-b border-r p-2 text-left transition-colors last:border-r-0",
                    "hover:bg-muted/30 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    !inMonth && "bg-muted/10 text-muted-foreground/50",
                    selected && "bg-primary/5 ring-1 ring-inset ring-primary/20",
                    today && !selected && "bg-sky-500/[0.03]",
                  )}
                >
                  <div className="mb-2 flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        "inline-flex size-7 items-center justify-center rounded-full text-sm font-medium",
                        today &&
                          "bg-sky-500 text-white shadow-sm",
                        selected && !today && "bg-primary text-primary-foreground",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {dayPosts.length > 0 ? (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                        {dayPosts.length}
                      </span>
                    ) : null}
                  </div>

                  <div className="space-y-1">
                    {dayPosts.slice(0, 3).map((post) => (
                      <div
                        key={post.id}
                        className={cn(
                          "truncate rounded-md border px-1.5 py-0.5 text-[0.65rem] font-medium leading-tight",
                          getPostBarClass(post.status),
                        )}
                        title={post.title}
                      >
                        {post.scheduled_at
                          ? format(new Date(post.scheduled_at), "h:mm a")
                          : ""}{" "}
                        {post.title}
                      </div>
                    ))}
                    {dayPosts.length > 3 ? (
                      <p className="px-1 text-[0.65rem] text-muted-foreground">
                        +{dayPosts.length - 3} more
                      </p>
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit shadow-sm xl:sticky xl:top-6">
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base">
            {format(selectedDate, "EEEE, MMM d")}
          </CardTitle>
          <CardDescription>
            {selectedDayPosts.length === 0
              ? "No posts scheduled for this day."
              : `${selectedDayPosts.length} post${selectedDayPosts.length === 1 ? "" : "s"} scheduled`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3 pt-4">
          {selectedDayPosts.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Plan content for this day by creating a post and setting a
                schedule.
              </p>
              <Button
                className="mt-4"
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href="/posts/new" />}
              >
                <Plus className="size-4" />
                Create post
              </Button>
            </div>
          ) : (
            selectedDayPosts.map((post) => (
              <Link
                key={post.id}
                href={`/posts/${post.id}/edit`}
                className="block rounded-xl border p-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{post.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {post.scheduled_at
                        ? format(new Date(post.scheduled_at), "h:mm a")
                        : "—"}{" "}
                      · {post.timezone}
                    </p>
                  </div>
                  <PostStatusBadge status={post.status} />
                </div>

                {post.platform_names.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {post.platform_names.map((name, index) => (
                      <PlatformChip
                        key={`${post.id}-${name}`}
                        platformKey={
                          post.platform_icon_keys[index] ??
                          post.platform_names[index] ??
                          name
                        }
                        label={name}
                      />
                    ))}
                  </div>
                ) : null}
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

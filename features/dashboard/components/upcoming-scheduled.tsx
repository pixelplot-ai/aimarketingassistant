import Link from "next/link"
import { format, formatDistanceToNow, isToday, isTomorrow } from "date-fns"
import { ArrowRight, CalendarClock } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { UpcomingScheduledPost } from "@/features/dashboard/queries"
import { cn } from "@/lib/utils"

interface UpcomingScheduledProps {
  posts: UpcomingScheduledPost[]
}

function formatRelativeSchedule(date: Date): string {
  if (isToday(date)) {
    return `Today · ${format(date, "h:mm a")}`
  }

  if (isTomorrow(date)) {
    return `Tomorrow · ${format(date, "h:mm a")}`
  }

  return format(date, "MMM d · h:mm a")
}

export function UpcomingScheduled({ posts }: UpcomingScheduledProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Upcoming Scheduled</CardTitle>
        <Button
          variant="ghost"
          size="xs"
          nativeButton={false}
          render={<Link href="/calendar" />}
          className="text-muted-foreground"
        >
          View calendar
          <ArrowRight className="size-3.5" />
        </Button>
      </CardHeader>
      <CardContent>
        {posts.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Nothing scheduled"
            description="Schedule a post to see upcoming publications here."
            className="py-10"
            action={
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/posts/new" />}
              >
                Schedule a post
              </Button>
            }
          />
        ) : (
          <ul className="relative space-y-0">
            {posts.map((post, index) => {
              const scheduledDate = post.scheduled_at
                ? new Date(post.scheduled_at)
                : null

              return (
                <li key={post.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {index < posts.length - 1 ? (
                    <span
                      className="absolute left-[0.6875rem] top-6 h-[calc(100%-0.5rem)] w-px bg-border"
                      aria-hidden
                    />
                  ) : null}

                  <span
                    className={cn(
                      "relative z-10 mt-1.5 size-3.5 shrink-0 rounded-full border-2 border-background bg-sky-500 ring-2 ring-sky-500/20",
                      index === 0 && "animate-pulse",
                    )}
                    aria-hidden
                  />

                  <Link
                    href={`/posts/${post.id}/edit`}
                    className="min-w-0 flex-1 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <p className="truncate font-medium">{post.title}</p>
                    <p className="mt-1 text-xs font-medium text-sky-700 dark:text-sky-400">
                      {scheduledDate
                        ? formatRelativeSchedule(scheduledDate)
                        : "No date"}
                    </p>
                    {scheduledDate ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDistanceToNow(scheduledDate, { addSuffix: true })}{" "}
                        · {post.timezone}
                      </p>
                    ) : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
      {posts.length > 0 ? (
        <CardFooter className="border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            nativeButton={false}
            render={<Link href="/calendar" />}
          >
            <CalendarClock className="size-4" />
            Open content calendar
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  )
}

import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { ContentCalendar } from "@/features/calendar/components/content-calendar"
import {
  formatDateParam,
  getCalendarGrid,
  getDefaultSelectedDate,
  groupPostsByDay,
  parseDateParam,
  parseMonthParam,
} from "@/features/calendar/lib/calendar-utils"
import { getCalendarPosts } from "@/features/calendar/queries"
import { getWorkspaceUserId } from "@/lib/auth/workspace"

interface CalendarPageProps {
  searchParams: Promise<{
    month?: string
    date?: string
  }>
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const workspaceUserId = await getWorkspaceUserId()

  const params = await searchParams
  const month = parseMonthParam(params.month)
  const dateParam = parseDateParam(params.date)
  const { gridStart, gridEnd } = getCalendarGrid(month)

  const posts = await getCalendarPosts(workspaceUserId, gridStart, gridEnd)
  const postsByDay = groupPostsByDay(posts)
  const selectedDate = getDefaultSelectedDate(month, dateParam, postsByDay)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Calendar"
        description="Visualize and plan your scheduled posts across the month."
        actions={
          <Button nativeButton={false} render={<Link href="/posts/new" />}>
            New Post
          </Button>
        }
      />

      <ContentCalendar
        posts={posts}
        month={month}
        selectedDate={selectedDate}
        key={`${formatDateParam(month)}-${formatDateParam(selectedDate)}`}
      />
    </div>
  )
}

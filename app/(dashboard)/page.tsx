import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { QuickActions } from "@/features/dashboard/components/quick-actions"
import { RecentActivity } from "@/features/dashboard/components/recent-activity"
import { RecentPosts } from "@/features/dashboard/components/recent-posts"
import { StatsCards } from "@/features/dashboard/components/stats-cards"
import { UpcomingScheduled } from "@/features/dashboard/components/upcoming-scheduled"
import {
  getDashboardStats,
  getRecentActivity,
  getRecentPosts,
  getUpcomingScheduled,
} from "@/features/dashboard/queries"
import { getWorkspaceUserId } from "@/lib/auth/workspace"

export default async function DashboardPage() {
  const workspaceUserId = await getWorkspaceUserId()

  const [stats, recentPosts, upcomingScheduled, recentActivity] =
    await Promise.all([
      getDashboardStats(workspaceUserId),
      getRecentPosts(workspaceUserId),
      getUpcomingScheduled(workspaceUserId),
      getRecentActivity(workspaceUserId),
    ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your social media content and activity."
        actions={
          <Button nativeButton={false} render={<Link href="/posts/new" />}>
            New Post
          </Button>
        }
      />

      <StatsCards stats={stats} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <RecentPosts posts={recentPosts} />
          <RecentActivity activity={recentActivity} />
        </div>
        <div className="space-y-6">
          <QuickActions />
          <UpcomingScheduled posts={upcomingScheduled} />
        </div>
      </div>
    </div>
  )
}

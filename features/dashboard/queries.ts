import { createClient } from "@/services/supabase/server"
import type { Enums, Tables } from "@/types/database"

export type DashboardStats = {
  total: number
  draft: number
  scheduled: number
  published: number
  failed: number
}

export type RecentPost = Pick<
  Tables<"posts">,
  "id" | "title" | "status" | "media_type" | "created_at" | "updated_at"
>

export type UpcomingScheduledPost = Pick<
  Tables<"posts">,
  "id" | "title" | "status" | "scheduled_at" | "timezone"
>

export type RecentActivityItem = {
  id: string
  status: Enums<"publication_status">
  created_at: string
  error_message: string | null
  published_at: string | null
  post_id: string
  post_title: string
  platform_id: string
  platform_name: string
}

async function countPostsByStatus(
  userId: string,
  status?: Enums<"post_status">,
): Promise<number> {
  const supabase = await createClient()

  let query = supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null)

  if (status) {
    query = query.eq("status", status)
  }

  const { count, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const [total, draft, scheduled, published, failed] = await Promise.all([
    countPostsByStatus(userId),
    countPostsByStatus(userId, "draft"),
    countPostsByStatus(userId, "scheduled"),
    countPostsByStatus(userId, "published"),
    countPostsByStatus(userId, "failed"),
  ])

  return { total, draft, scheduled, published, failed }
}

export async function getRecentPosts(
  userId: string,
  limit = 5,
): Promise<RecentPost[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("posts")
    .select("id, title, status, media_type, created_at, updated_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function getUpcomingScheduled(
  userId: string,
  limit = 5,
): Promise<UpcomingScheduledPost[]> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from("posts")
    .select("id, title, status, scheduled_at, timezone")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("status", "scheduled")
    .not("scheduled_at", "is", null)
    .gte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function getRecentActivity(
  userId: string,
  limit = 10,
): Promise<RecentActivityItem[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("publication_logs")
    .select(
      `
      id,
      status,
      created_at,
      error_message,
      published_at,
      post_id,
      platform_id,
      posts!inner (
        title,
        user_id,
        deleted_at
      ),
      platforms (
        display_name
      )
    `,
    )
    .eq("posts.user_id", userId)
    .is("posts.deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  type ActivityRow = {
    id: string
    status: Enums<"publication_status">
    created_at: string
    error_message: string | null
    published_at: string | null
    post_id: string
    platform_id: string
    posts: { title: string; user_id: string; deleted_at: string | null }
    platforms: { display_name: string } | null
  }

  const rows = (data ?? []) as ActivityRow[]

  return rows.map((item) => ({
    id: item.id,
    status: item.status,
    created_at: item.created_at,
    error_message: item.error_message,
    published_at: item.published_at,
    post_id: item.post_id,
    post_title: item.posts.title ?? "Untitled post",
    platform_id: item.platform_id,
    platform_name: item.platforms?.display_name ?? item.platform_id,
  }))
}

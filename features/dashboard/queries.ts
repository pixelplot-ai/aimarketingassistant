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

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("posts")
    .select("status")
    .eq("user_id", userId)
    .is("deleted_at", null)

  if (error) {
    throw new Error(error.message)
  }

  const posts = data ?? []
  const countByStatus = (status: Enums<"post_status">) =>
    posts.filter((post) => post.status === status).length

  return {
    total: posts.length,
    draft: countByStatus("draft"),
    scheduled: countByStatus("scheduled"),
    published: countByStatus("published"),
    failed: countByStatus("failed"),
  }
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

  const { data: userPosts, error: postsError } = await supabase
    .from("posts")
    .select("id, title")
    .eq("user_id", userId)
    .is("deleted_at", null)

  if (postsError) {
    throw new Error(postsError.message)
  }

  const postIds = (userPosts ?? []).map((post) => post.id)
  if (postIds.length === 0) {
    return []
  }

  const postTitleById = new Map(
    (userPosts ?? []).map((post) => [post.id, post.title]),
  )

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
      platforms (
        display_name
      )
    `,
    )
    .in("post_id", postIds)
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
    post_title: postTitleById.get(item.post_id) ?? "Untitled post",
    platform_id: item.platform_id,
    platform_name: item.platforms?.display_name ?? item.platform_id,
  }))
}

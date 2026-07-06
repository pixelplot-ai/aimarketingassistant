import { createClient } from "@/services/supabase/server"
import type { Enums, Tables } from "@/types/database"

export type CalendarPost = Pick<
  Tables<"posts">,
  "id" | "title" | "status" | "scheduled_at" | "timezone" | "media_type"
> & {
  platform_names: string[]
  platform_icon_keys: string[]
}

async function attachPlatformsToCalendarPosts(
  posts: Tables<"posts">[],
): Promise<CalendarPost[]> {
  if (posts.length === 0) {
    return []
  }

  const supabase = await createClient()
  const postIds = posts.map((post) => post.id)

  const { data: postPlatforms, error } = await supabase
    .from("post_platforms")
    .select("post_id, platform_id, platforms(display_name, icon_key)")
    .in("post_id", postIds)

  if (error) {
    throw new Error(error.message)
  }

  type PostPlatformRow = {
    post_id: string
    platform_id: string
    platforms: { display_name: string; icon_key: string } | null
  }

  const platformMap = new Map<
    string,
    { names: string[]; iconKeys: string[] }
  >()

  for (const row of (postPlatforms ?? []) as PostPlatformRow[]) {
    const existing = platformMap.get(row.post_id) ?? {
      names: [],
      iconKeys: [],
    }
    existing.names.push(row.platforms?.display_name ?? row.platform_id)
    existing.iconKeys.push(row.platforms?.icon_key ?? row.platform_id)
    platformMap.set(row.post_id, existing)
  }

  return posts.map((post) => {
    const platforms = platformMap.get(post.id) ?? { names: [], iconKeys: [] }
    return {
      id: post.id,
      title: post.title,
      status: post.status,
      scheduled_at: post.scheduled_at,
      timezone: post.timezone,
      media_type: post.media_type,
      platform_names: platforms.names,
      platform_icon_keys: platforms.iconKeys,
    }
  })
}

export async function getCalendarPosts(
  userId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<CalendarPost[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("posts")
    .select("id, title, status, scheduled_at, timezone, media_type")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .not("scheduled_at", "is", null)
    .gte("scheduled_at", rangeStart.toISOString())
    .lte("scheduled_at", rangeEnd.toISOString())
    .in("status", ["scheduled", "published", "publishing", "failed"] as Enums<"post_status">[])
    .order("scheduled_at", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return attachPlatformsToCalendarPosts((data ?? []) as Tables<"posts">[])
}

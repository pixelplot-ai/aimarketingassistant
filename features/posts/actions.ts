"use server"

import { revalidatePath } from "next/cache"

import { canSchedulePost, resolvePostStatusFromSchedule } from "@/features/posts/lib/post-status"
import { getWorkspaceUserId } from "@/lib/auth/workspace"
import { AppError } from "@/lib/errors/app-error"
import {
  postFilterSchema,
  postFormSchema,
  type PostFilterValues,
  type PostFormValues,
} from "@/lib/validations/post"
import { createClient } from "@/services/supabase/server"
import {
  cancelPendingScheduledJobs,
  createScheduledJobs,
  publishPost,
  retryFailedJobs,
} from "@/services/scheduler/publish-service"
import type { Enums, Tables } from "@/types/database"

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

export type PostWithPlatforms = Tables<"posts"> & {
  platform_ids: string[]
  platform_names: string[]
  platform_icon_keys: string[]
}

export type ListPostsResult = {
  posts: PostWithPlatforms[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

async function getAuthenticatedUserId(): Promise<string> {
  return getWorkspaceUserId()
}

async function syncPostPlatforms(postId: string, platformIds: string[]) {
  const supabase = await createClient()

  const { error: deleteError } = await supabase
    .from("post_platforms")
    .delete()
    .eq("post_id", postId)

  if (deleteError) {
    throw new AppError({
      code: "INTERNAL",
      message: deleteError.message,
      userMessage: "Failed to update post platforms.",
    })
  }

  if (platformIds.length === 0) {
    return
  }

  const { error: insertError } = await supabase.from("post_platforms").insert(
    platformIds.map((platformId) => ({
      post_id: postId,
      platform_id: platformId,
    })),
  )

  if (insertError) {
    throw new AppError({
      code: "INTERNAL",
      message: insertError.message,
      userMessage: "Failed to update post platforms.",
    })
  }
}

async function attachPlatformsToPosts(
  posts: Tables<"posts">[],
): Promise<PostWithPlatforms[]> {
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
    throw new AppError({
      code: "INTERNAL",
      message: error.message,
      userMessage: "Failed to load post platforms.",
    })
  }

  type PostPlatformRow = {
    post_id: string
    platform_id: string
    platforms: { display_name: string; icon_key: string } | null
  }

  const platformMap = new Map<
    string,
    { ids: string[]; names: string[]; iconKeys: string[] }
  >()

  for (const row of (postPlatforms ?? []) as PostPlatformRow[]) {
    const existing = platformMap.get(row.post_id) ?? {
      ids: [],
      names: [],
      iconKeys: [],
    }
    existing.ids.push(row.platform_id)
    existing.names.push(row.platforms?.display_name ?? row.platform_id)
    existing.iconKeys.push(
      row.platforms?.icon_key ?? row.platform_id,
    )
    platformMap.set(row.post_id, existing)
  }

  return posts.map((post) => {
    const platforms = platformMap.get(post.id) ?? {
      ids: [],
      names: [],
      iconKeys: [],
    }
    return {
      ...post,
      platform_ids: platforms.ids,
      platform_names: platforms.names,
      platform_icon_keys: platforms.iconKeys,
    }
  })
}

function toActionError(error: unknown): ActionResult<never> {
  if (AppError.isAppError(error)) {
    return { success: false, error: error.userMessage }
  }

  if (error instanceof Error) {
    return { success: false, error: error.message }
  }

  return { success: false, error: "Something went wrong. Please try again." }
}

export async function getPlatforms(): Promise<
  ActionResult<Tables<"platforms">[]>
> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("platforms")
      .select("*")
      .eq("is_enabled", true)
      .order("sort_order", { ascending: true })

    if (error) {
      throw new AppError({
        code: "INTERNAL",
        message: error.message,
        userMessage: "Failed to load platforms.",
      })
    }

    return { success: true, data: data ?? [] }
  } catch (error) {
    return toActionError(error)
  }
}

export async function getPost(
  postId: string,
): Promise<ActionResult<PostWithPlatforms>> {
  try {
    const userId = await getAuthenticatedUserId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("id", postId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throw new AppError({
        code: "INTERNAL",
        message: error.message,
        userMessage: "Failed to load post.",
      })
    }

    if (!data) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Post not found",
        userMessage: "Post not found.",
      })
    }

    const [post] = await attachPlatformsToPosts([data])
    return { success: true, data: post }
  } catch (error) {
    return toActionError(error)
  }
}

export async function listPosts(
  filters: Partial<PostFilterValues> = {},
): Promise<ActionResult<ListPostsResult>> {
  try {
    const userId = await getAuthenticatedUserId()
    const parsed = postFilterSchema.parse(filters)
    const supabase = await createClient()
    const from = (parsed.page - 1) * parsed.page_size
    const to = from + parsed.page_size - 1

    let query = supabase
      .from("posts")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .is("deleted_at", null)

    if (parsed.search) {
      const term = `%${parsed.search.trim()}%`
      query = query.or(`title.ilike.${term},content.ilike.${term}`)
    }

    if (parsed.status !== "all") {
      query = query.eq("status", parsed.status)
    }

    if (parsed.media_type !== "all") {
      query = query.eq("media_type", parsed.media_type)
    }

    if (parsed.date_from) {
      query = query.gte("created_at", parsed.date_from)
    }

    if (parsed.date_to) {
      query = query.lte("created_at", parsed.date_to)
    }

    if (parsed.platform_id !== "all") {
      const { data: platformPosts, error: platformError } = await supabase
        .from("post_platforms")
        .select("post_id")
        .eq("platform_id", parsed.platform_id)

      if (platformError) {
        throw new AppError({
          code: "INTERNAL",
          message: platformError.message,
          userMessage: "Failed to filter posts by platform.",
        })
      }

      const postIds = (platformPosts ?? []).map((row) => row.post_id)
      if (postIds.length === 0) {
        return {
          success: true,
          data: {
            posts: [],
            total: 0,
            page: parsed.page,
            pageSize: parsed.page_size,
            totalPages: 0,
          },
        }
      }

      query = query.in("id", postIds)
    }

    const { data, error, count } = await query
      .order(parsed.sort_by, { ascending: parsed.sort_order === "asc" })
      .range(from, to)

    if (error) {
      throw new AppError({
        code: "INTERNAL",
        message: error.message,
        userMessage: "Failed to load posts.",
      })
    }

    const posts = await attachPlatformsToPosts(data ?? [])
    const total = count ?? 0

    return {
      success: true,
      data: {
        posts,
        total,
        page: parsed.page,
        pageSize: parsed.page_size,
        totalPages: total === 0 ? 0 : Math.ceil(total / parsed.page_size),
      },
    }
  } catch (error) {
    return toActionError(error)
  }
}

export async function createPost(
  values: PostFormValues,
): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await getAuthenticatedUserId()
    const parsed = postFormSchema.parse(values)
    const supabase = await createClient()
    const status = canSchedulePost(parsed)
      ? "scheduled"
      : resolvePostStatusFromSchedule(parsed.scheduled_at)
    const title =
      parsed.title.trim() ||
      parsed.content.trim().slice(0, 200) ||
      "Untitled post"

    const { data, error } = await supabase
      .from("posts")
      .insert({
        user_id: userId,
        title,
        content: parsed.content,
        media_type: parsed.media_type,
        status,
        scheduled_at: parsed.scheduled_at ?? null,
        timezone: parsed.timezone,
        brand_profile_id: parsed.brand_profile_id ?? null,
      })
      .select("id")
      .single()

    if (error || !data) {
      throw new AppError({
        code: "INTERNAL",
        message: error?.message ?? "Failed to create post",
        userMessage: "Failed to create post.",
      })
    }

    await syncPostPlatforms(data.id, parsed.platform_ids)

    if (status === "scheduled" && parsed.scheduled_at) {
      await createScheduledJobs(data.id, parsed.platform_ids, parsed.scheduled_at)
    }

    revalidatePath("/")
    revalidatePath("/posts")

    return { success: true, data: { id: data.id } }
  } catch (error) {
    return toActionError(error)
  }
}

export async function updatePost(
  postId: string,
  values: PostFormValues,
): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await getAuthenticatedUserId()
    const parsed = postFormSchema.parse(values)
    const supabase = await createClient()

    const { data: existing, error: fetchError } = await supabase
      .from("posts")
      .select("status")
      .eq("id", postId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle()

    if (fetchError || !existing) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Post not found",
        userMessage: "Post not found.",
      })
    }

    if (existing.status === "publishing") {
      throw new AppError({
        code: "VALIDATION",
        message: "Post is publishing",
        userMessage: "This post is publishing. Wait until it finishes before editing.",
      })
    }

    const status = canSchedulePost(parsed)
      ? "scheduled"
      : resolvePostStatusFromSchedule(
          parsed.scheduled_at,
          existing.status,
        )

    const title =
      parsed.title.trim() ||
      parsed.content.trim().slice(0, 200) ||
      "Untitled post"

    const { data, error } = await supabase
      .from("posts")
      .update({
        title,
        content: parsed.content,
        media_type: parsed.media_type,
        status,
        scheduled_at: parsed.scheduled_at ?? null,
        timezone: parsed.timezone,
        brand_profile_id: parsed.brand_profile_id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle()

    if (error) {
      throw new AppError({
        code: "INTERNAL",
        message: error.message,
        userMessage: "Failed to update post.",
      })
    }

    if (!data) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Post not found",
        userMessage: "Post not found.",
      })
    }

    await syncPostPlatforms(postId, parsed.platform_ids)

    if (status === "scheduled" && parsed.scheduled_at) {
      await createScheduledJobs(postId, parsed.platform_ids, parsed.scheduled_at)
    } else {
      await cancelPendingScheduledJobs(postId)
    }

    revalidatePath("/")
    revalidatePath("/posts")
    revalidatePath(`/posts/${postId}/edit`)

    return { success: true, data: { id: data.id } }
  } catch (error) {
    return toActionError(error)
  }
}

export async function deletePost(postId: string): Promise<ActionResult> {
  try {
    const userId = await getAuthenticatedUserId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("posts")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle()

    if (error) {
      throw new AppError({
        code: "INTERNAL",
        message: error.message,
        userMessage: "Failed to delete post.",
      })
    }

    if (!data) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Post not found",
        userMessage: "Post not found.",
      })
    }

    revalidatePath("/")
    revalidatePath("/posts")

    return { success: true, data: undefined }
  } catch (error) {
    return toActionError(error)
  }
}

export async function schedulePost(
  postId: string,
  values: PostFormValues,
): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await getAuthenticatedUserId()
    const parsed = postFormSchema.parse(values)

    if (!parsed.scheduled_at) {
      throw new AppError({
        code: "VALIDATION",
        message: "scheduled_at is required",
        userMessage: "Choose a date and time to schedule publication.",
      })
    }

    const scheduledDate = new Date(parsed.scheduled_at)
    if (Number.isNaN(scheduledDate.getTime())) {
      throw new AppError({
        code: "VALIDATION",
        message: "Invalid scheduled_at",
        userMessage: "Invalid schedule date.",
      })
    }

    if (scheduledDate <= new Date()) {
      throw new AppError({
        code: "VALIDATION",
        message: "scheduled_at must be in the future",
        userMessage: "Schedule time must be in the future.",
      })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from("posts")
      .update({
        title: parsed.title,
        content: parsed.content,
        media_type: parsed.media_type,
        status: "scheduled",
        scheduled_at: parsed.scheduled_at,
        timezone: parsed.timezone,
        brand_profile_id: parsed.brand_profile_id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle()

    if (error) {
      throw new AppError({
        code: "INTERNAL",
        message: error.message,
        userMessage: "Failed to schedule post.",
      })
    }

    if (!data) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Post not found",
        userMessage: "Post not found.",
      })
    }

    await syncPostPlatforms(postId, parsed.platform_ids)
    await createScheduledJobs(postId, parsed.platform_ids, parsed.scheduled_at)

    revalidatePath("/")
    revalidatePath("/posts")
    revalidatePath(`/posts/${postId}/edit`)

    return { success: true, data: { id: data.id } }
  } catch (error) {
    return toActionError(error)
  }
}

export async function publishNow(
  postId: string,
  values: PostFormValues,
): Promise<ActionResult<{ id: string; publish: Awaited<ReturnType<typeof publishPost>> }>> {
  try {
    const userId = await getAuthenticatedUserId()
    const parsed = postFormSchema.parse(values)
    const supabase = await createClient()
    const runAt = new Date().toISOString()

    const { data, error } = await supabase
      .from("posts")
      .update({
        title: parsed.title,
        content: parsed.content,
        media_type: parsed.media_type,
        status: "publishing",
        scheduled_at: runAt,
        timezone: parsed.timezone,
        brand_profile_id: parsed.brand_profile_id ?? null,
        updated_at: runAt,
      })
      .eq("id", postId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle()

    if (error) {
      throw new AppError({
        code: "INTERNAL",
        message: error.message,
        userMessage: "Failed to publish post.",
      })
    }

    if (!data) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Post not found",
        userMessage: "Post not found.",
      })
    }

    await syncPostPlatforms(postId, parsed.platform_ids)
    await createScheduledJobs(postId, parsed.platform_ids, runAt)

    const publishResult = await publishPost(postId)

    revalidatePath("/")
    revalidatePath("/posts")
    revalidatePath(`/posts/${postId}/edit`)

    if (publishResult.failed > 0 && publishResult.succeeded === 0) {
      return {
        success: false,
        error: publishResult.errors[0] ?? "Publishing failed for all platforms.",
      }
    }

    return {
      success: true,
      data: { id: data.id, publish: publishResult },
    }
  } catch (error) {
    return toActionError(error)
  }
}

export async function retryFailedPost(
  postId: string,
): Promise<ActionResult<{ id: string; publish: Awaited<ReturnType<typeof publishPost>> }>> {
  try {
    const userId = await getAuthenticatedUserId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("posts")
      .select("id, status")
      .eq("id", postId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) {
      throw new AppError({
        code: "INTERNAL",
        message: error.message,
        userMessage: "Failed to retry post.",
      })
    }

    if (!data) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Post not found",
        userMessage: "Post not found.",
      })
    }

    if (data.status !== "failed") {
      throw new AppError({
        code: "VALIDATION",
        message: "Post is not in failed status",
        userMessage: "Only failed posts can be retried.",
      })
    }

    await retryFailedJobs(postId)

    await supabase
      .from("posts")
      .update({
        status: "publishing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId)

    const publishResult = await publishPost(postId)

    revalidatePath("/")
    revalidatePath("/posts")
    revalidatePath(`/posts/${postId}/edit`)

    if (publishResult.failed > 0 && publishResult.succeeded === 0) {
      return {
        success: false,
        error: publishResult.errors[0] ?? "Retry failed for all platforms.",
      }
    }

    return {
      success: true,
      data: { id: data.id, publish: publishResult },
    }
  } catch (error) {
    return toActionError(error)
  }
}

export async function duplicatePost(
  postId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await getAuthenticatedUserId()
    const supabase = await createClient()

    const { data: source, error: sourceError } = await supabase
      .from("posts")
      .select("*")
      .eq("id", postId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle()

    if (sourceError) {
      throw new AppError({
        code: "INTERNAL",
        message: sourceError.message,
        userMessage: "Failed to duplicate post.",
      })
    }

    if (!source) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Post not found",
        userMessage: "Post not found.",
      })
    }

    const { data: platforms, error: platformsError } = await supabase
      .from("post_platforms")
      .select("platform_id")
      .eq("post_id", postId)

    if (platformsError) {
      throw new AppError({
        code: "INTERNAL",
        message: platformsError.message,
        userMessage: "Failed to duplicate post.",
      })
    }

    const { data: duplicate, error: duplicateError } = await supabase
      .from("posts")
      .insert({
        user_id: userId,
        title: `${source.title} (Copy)`,
        content: source.content,
        media_type: source.media_type,
        status: "draft",
        scheduled_at: null,
        timezone: source.timezone,
        brand_profile_id: source.brand_profile_id,
      })
      .select("id")
      .single()

    if (duplicateError || !duplicate) {
      throw new AppError({
        code: "INTERNAL",
        message: duplicateError?.message ?? "Failed to duplicate post",
        userMessage: "Failed to duplicate post.",
      })
    }

    const platformIds = (platforms ?? []).map((row) => row.platform_id)
    if (platformIds.length > 0) {
      await syncPostPlatforms(duplicate.id, platformIds)
    }

    revalidatePath("/")
    revalidatePath("/posts")

    return { success: true, data: { id: duplicate.id } }
  } catch (error) {
    return toActionError(error)
  }
}

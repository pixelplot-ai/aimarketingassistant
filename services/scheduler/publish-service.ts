import "@/features/integrations/registry"
import { getConnector } from "@/features/integrations/registry"
import { decryptToken } from "@/features/integrations/shared/token-encryption"
import type { ConnectionContext, PublishInput } from "@/features/integrations/types"
import { createAdminClient } from "@/services/supabase/admin"
import {
  bucketForMediaType,
  createAdminSignedUrl,
} from "@/services/storage/upload"
import type { Json, Tables } from "@/types/database"

const MAX_ATTEMPTS = 3

export type PublishRunResult = {
  postId: string
  processedJobs: number
  succeeded: number
  failed: number
  errors: string[]
}

type PostWithPlatforms = Tables<"posts"> & {
  platform_ids: string[]
}

async function loadPost(postId: string): Promise<PostWithPlatforms | null> {
  const supabase = createAdminClient()

  const { data: post, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", postId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error || !post) {
    return null
  }

  const { data: platformRows } = await supabase
    .from("post_platforms")
    .select("platform_id")
    .eq("post_id", postId)

  return {
    ...post,
    platform_ids: (platformRows ?? []).map((row) => row.platform_id),
  }
}

async function resolveImageUrl(postId: string): Promise<string | null> {
  const supabase = createAdminClient()

  const { data: media } = await supabase
    .from("post_media")
    .select("storage_path, media_type")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!media?.storage_path) {
    return null
  }

  const bucket = bucketForMediaType(media.media_type)
  return createAdminSignedUrl(bucket, media.storage_path, 60 * 60 * 24)
}

async function getPlatformConnection(
  userId: string,
  platformId: string,
): Promise<Tables<"platform_connections"> | null> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from("platform_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("platform_id", platformId)
    .eq("status", "connected")
    .maybeSingle()

  return data
}

async function writePublicationLog(input: {
  postId: string
  platformId: string
  platformConnectionId: string | null
  status: "success" | "failed"
  externalPostId?: string | null
  errorMessage?: string | null
  requestPayload?: Record<string, unknown> | null
  responsePayload?: Record<string, unknown> | null
}) {
  const supabase = createAdminClient()

  await supabase.from("publication_logs").insert({
    post_id: input.postId,
    platform_id: input.platformId,
    platform_connection_id: input.platformConnectionId,
    status: input.status,
    external_post_id: input.externalPostId ?? null,
    error_message: input.errorMessage ?? null,
    request_payload: (input.requestPayload ?? null) as Json,
    response_payload: (input.responsePayload ?? null) as Json,
    published_at: input.status === "success" ? new Date().toISOString() : null,
  })
}

async function updateJobStatus(
  jobId: string,
  updates: Partial<Tables<"scheduled_jobs">>,
) {
  const supabase = createAdminClient()

  await supabase
    .from("scheduled_jobs")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
}

async function finalizePostStatus(postId: string) {
  const supabase = createAdminClient()

  const { data: jobs } = await supabase
    .from("scheduled_jobs")
    .select("status")
    .eq("post_id", postId)

  const statuses = (jobs ?? []).map((job) => job.status)
  if (statuses.length === 0) {
    return
  }

  let postStatus: Tables<"posts">["status"] = "published"
  if (statuses.some((status) => status === "failed")) {
    postStatus = statuses.every((status) => status === "failed")
      ? "failed"
      : "published"
  } else if (statuses.some((status) => status === "pending" || status === "processing")) {
    postStatus = "publishing"
  }

  await supabase
    .from("posts")
    .update({
      status: postStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId)
}

async function publishToPlatform(
  post: PostWithPlatforms,
  platformId: string,
  jobId?: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient()

  if (jobId) {
    await updateJobStatus(jobId, { status: "processing" })
  }

  const connection = await getPlatformConnection(post.user_id, platformId)
  if (!connection?.access_token_encrypted) {
    const error = `No active connection for ${platformId}`
    await writePublicationLog({
      postId: post.id,
      platformId,
      platformConnectionId: connection?.id ?? null,
      status: "failed",
      errorMessage: error,
    })

    if (jobId) {
      const { data: job } = await supabase
        .from("scheduled_jobs")
        .select("attempts, max_attempts")
        .eq("id", jobId)
        .single()

      const attempts = (job?.attempts ?? 0) + 1
      const maxAttempts = job?.max_attempts ?? MAX_ATTEMPTS

      await updateJobStatus(jobId, {
        attempts,
        last_error: error,
        status: attempts >= maxAttempts ? "failed" : "pending",
      })
    }

    return { success: false, error }
  }

  const accessToken = decryptToken(connection.access_token_encrypted)
  const connector = getConnector(platformId)
  const imageUrl = post.media_type === "image" ? await resolveImageUrl(post.id) : null

  const publishInput: PublishInput = {
    text: post.content,
    imageUrl,
  }

  const connectionContext: ConnectionContext = {
    externalAccountId: connection.external_account_id ?? "",
    accountName: connection.account_name,
    metadata: (connection.metadata ?? {}) as Record<string, unknown>,
  }

  const result = await connector.publish(
    accessToken,
    publishInput,
    connectionContext,
  )

  if (result.success) {
    await writePublicationLog({
      postId: post.id,
      platformId,
      platformConnectionId: connection.id,
      status: "success",
      externalPostId: result.externalPostId,
      requestPayload: result.requestPayload,
      responsePayload: result.responsePayload,
    })

    if (jobId) {
      await updateJobStatus(jobId, {
        status: "completed",
        last_error: null,
      })
    }

    return { success: true }
  }

  const error = result.error ?? "Publish failed"
  await writePublicationLog({
    postId: post.id,
    platformId,
    platformConnectionId: connection.id,
    status: "failed",
    errorMessage: error,
    requestPayload: result.requestPayload,
    responsePayload: result.responsePayload,
  })

  if (jobId) {
    const { data: job } = await supabase
      .from("scheduled_jobs")
      .select("attempts, max_attempts")
      .eq("id", jobId)
      .single()

    const attempts = (job?.attempts ?? 0) + 1
    const maxAttempts = job?.max_attempts ?? MAX_ATTEMPTS

    await updateJobStatus(jobId, {
      attempts,
      last_error: error,
      status: attempts >= maxAttempts ? "failed" : "pending",
    })
  }

  return { success: false, error }
}

export async function publishPost(postId: string): Promise<PublishRunResult> {
  const post = await loadPost(postId)
  if (!post) {
    return {
      postId,
      processedJobs: 0,
      succeeded: 0,
      failed: 0,
      errors: ["Post not found"],
    }
  }

  const supabase = createAdminClient()
  await supabase
    .from("posts")
    .update({ status: "publishing", updated_at: new Date().toISOString() })
    .eq("id", postId)

  const platformIds =
    post.platform_ids.length > 0 ? post.platform_ids : []

  if (platformIds.length === 0) {
    return {
      postId,
      processedJobs: 0,
      succeeded: 0,
      failed: 0,
      errors: ["No platforms selected for this post"],
    }
  }

  let succeeded = 0
  let failed = 0
  const errors: string[] = []

  for (const platformId of platformIds) {
    const { data: job } = await supabase
      .from("scheduled_jobs")
      .select("*")
      .eq("post_id", postId)
      .eq("platform_id", platformId)
      .in("status", ["pending", "processing", "failed"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    const outcome = await publishToPlatform(post, platformId, job?.id)
    if (outcome.success) {
      succeeded += 1
    } else {
      failed += 1
      if (outcome.error) {
        errors.push(outcome.error)
      }
    }
  }

  await finalizePostStatus(postId)

  return {
    postId,
    processedJobs: platformIds.length,
    succeeded,
    failed,
    errors,
  }
}

/**
 * Processes due scheduled jobs and publishes posts whose run_at has passed.
 *
 * Supabase pg_cron setup (run once in SQL editor or a migration):
 *
 * ```sql
 * -- Enable extensions (Dashboard → Database → Extensions)
 * create extension if not exists pg_cron with schema pg_catalog;
 *
 * -- Schedule HTTP call to the publish cron route every minute
 * select cron.schedule(
 *   'publish-due-posts',
 *   '* * * * *',
 *   $$
 *   select net.http_post(
 *     url := current_setting('app.settings.app_url', true) || '/api/cron/publish',
 *     headers := jsonb_build_object(
 *       'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true),
 *       'Content-Type', 'application/json'
 *     ),
 *     body := '{}'::jsonb
 *   );
 *   $$
 * );
 *
 * -- Store secrets (replace values):
 * alter database postgres set app.settings.app_url = 'https://your-app.example.com';
 * alter database postgres set app.settings.cron_secret = 'your-cron-secret';
 * ```
 *
 * Alternative: use Vercel Cron / external scheduler to POST /api/cron/publish
 * with header `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function publishDuePosts(): Promise<PublishRunResult[]> {
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const { data: dueJobs, error } = await supabase
    .from("scheduled_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("run_at", now)
    .lt("attempts", MAX_ATTEMPTS)
    .order("run_at", { ascending: true })
    .limit(50)

  if (error) {
    throw new Error(error.message)
  }

  const jobs = dueJobs ?? []
  const postIds = [...new Set(jobs.map((job) => job.post_id))]
  const results: PublishRunResult[] = []

  for (const postId of postIds) {
    const postJobs = jobs.filter((job) => job.post_id === postId)
    const post = await loadPost(postId)

    if (!post) {
      for (const job of postJobs) {
        await updateJobStatus(job.id, {
          status: "failed",
          last_error: "Post not found",
          attempts: job.attempts + 1,
        })
      }
      continue
    }

    let succeeded = 0
    let failed = 0
    const errors: string[] = []

    for (const job of postJobs) {
      const outcome = await publishToPlatform(post, job.platform_id, job.id)
      if (outcome.success) {
        succeeded += 1
      } else {
        failed += 1
        if (outcome.error) {
          errors.push(outcome.error)
        }
      }
    }

    await finalizePostStatus(postId)

    results.push({
      postId,
      processedJobs: postJobs.length,
      succeeded,
      failed,
      errors,
    })
  }

  return results
}

export async function createScheduledJobs(
  postId: string,
  platformIds: string[],
  runAt: string,
): Promise<void> {
  const supabase = createAdminClient()

  await supabase
    .from("scheduled_jobs")
    .delete()
    .eq("post_id", postId)
    .in("status", ["pending", "failed"])

  if (platformIds.length === 0) {
    return
  }

  await supabase.from("scheduled_jobs").insert(
    platformIds.map((platformId) => ({
      post_id: postId,
      platform_id: platformId,
      run_at: runAt,
      status: "pending" as const,
      attempts: 0,
      max_attempts: MAX_ATTEMPTS,
    })),
  )
}

export async function cancelPendingScheduledJobs(postId: string): Promise<void> {
  const supabase = createAdminClient()

  await supabase
    .from("scheduled_jobs")
    .delete()
    .eq("post_id", postId)
    .in("status", ["pending", "failed"])
}

export async function retryFailedJobs(postId: string): Promise<void> {
  const supabase = createAdminClient()

  await supabase
    .from("scheduled_jobs")
    .update({
      status: "pending",
      attempts: 0,
      last_error: null,
      run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("post_id", postId)
    .eq("status", "failed")
}

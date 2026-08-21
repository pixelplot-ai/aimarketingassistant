import { NextResponse } from "next/server"

import { isAdminEmail } from "@/lib/auth/admin"
import { seedanceGenerateBodySchema } from "@/lib/seedance/types"
import { SEEDANCE_REFS_BUCKET } from "@/lib/seedance/constants"
import { resolveSeedanceModelId } from "@/services/byteplus/config"
import { startSeedanceTask } from "@/services/byteplus/seedance"
import { createAdminClient } from "@/services/supabase/admin"
import { createClient } from "@/services/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

async function createSignedUrls(
  paths: string[],
  userId: string,
): Promise<string[]> {
  if (paths.length === 0) return []

  for (const path of paths) {
    if (!path.startsWith(`${userId}/`)) {
      throw new Error("Invalid media path.")
    }
  }

  const admin = createAdminClient()
  const urls: string[] = []

  for (const path of paths) {
    const { data, error } = await admin.storage
      .from(SEEDANCE_REFS_BUCKET)
      .createSignedUrl(path, 60 * 60)

    if (error || !data?.signedUrl) {
      throw new Error(error?.message || `Could not sign URL for ${path}`)
    }
    urls.push(data.signedUrl)
  }

  return urls
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminEmail(user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const json = await request.json()
    const parsed = seedanceGenerateBodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      )
    }

    const body = parsed.data
    const signedImageUrls = await createSignedUrls(body.imagePaths, user.id)
    // Avatar assets first (verified faces), then ad-hoc uploads.
    const imageUrls = [...body.assetUris, ...signedImageUrls]
    const audioUrls = body.audioPath
      ? await createSignedUrls([body.audioPath], user.id)
      : []

    const { data: job, error: insertError } = await supabase
      .from("seedance_jobs")
      .insert({
        user_id: user.id,
        status: "queued",
        prompt: body.prompt,
      })
      .select("id")
      .single()

    if (insertError || !job) {
      return NextResponse.json(
        { error: insertError?.message ?? "Could not create job" },
        { status: 500 },
      )
    }

    try {
      const quality =
        body.modelOptionId === "seedance_2_0_fast" ? "standard" : body.quality

      const started = await startSeedanceTask({
        prompt: body.prompt,
        imageUrls,
        audioUrl: audioUrls[0] ?? null,
        model: resolveSeedanceModelId(body.modelOptionId),
        durationSeconds: body.durationSeconds,
        smartDuration: body.smartDuration,
        ratio: body.ratio,
        quality,
        generateAudio: body.generateAudio,
      })

      const admin = createAdminClient()
      const { error: updateError } = await admin
        .from("seedance_jobs")
        .update({
          provider_task_id: started.providerTaskId,
          status: "processing",
        })
        .eq("id", job.id)

      if (updateError) {
        console.error("[seedance] failed to save provider task id:", updateError)
      }

      return NextResponse.json({
        jobId: job.id,
        providerTaskId: started.providerTaskId,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start Seedance task"
      const admin = createAdminClient()
      await admin
        .from("seedance_jobs")
        .update({ status: "failed", error: message })
        .eq("id", job.id)

      return NextResponse.json({ error: message, jobId: job.id }, { status: 502 })
    }
  } catch (err) {
    console.error("[seedance] generate error:", err)
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

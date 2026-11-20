import { NextResponse } from "next/server"

import { isAdminEmail } from "@/lib/auth/admin"
import { SEEDANCE_REFS_BUCKET } from "@/lib/seedance/constants"
import type { SeedanceJobRow } from "@/lib/seedance/types"
import { getSeedanceTask } from "@/services/byteplus/seedance"
import { applyGeminiOutcome } from "@/services/gemini/completeJob"
import { getGeminiOmniTask } from "@/services/gemini/omni"
import { createAdminClient } from "@/services/supabase/admin"
import { createClient } from "@/services/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 120

type RouteContext = {
  params: Promise<{ id: string }>
}

async function withPlayableUrl(row: SeedanceJobRow): Promise<SeedanceJobRow> {
  if (!row.output_path) return row
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(SEEDANCE_REFS_BUCKET)
    .createSignedUrl(row.output_path, 60 * 60)
  if (error || !data?.signedUrl) return row
  return { ...row, output_url: data.signedUrl }
}

function mapProviderStatusToJob(
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled",
): SeedanceJobRow["status"] {
  if (status === "succeeded") return "succeeded"
  if (status === "failed" || status === "canceled") return "failed"
  if (status === "processing") return "processing"
  return "queued"
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
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

    const { data: job, error } = await supabase
      .from("seedance_jobs")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    const row = job as SeedanceJobRow

    if (
      row.provider === "gemini" &&
      row.provider_task_id &&
      (row.status === "queued" || row.status === "processing")
    ) {
      try {
        const state = await getGeminiOmniTask(row.provider_task_id)
        await applyGeminiOutcome({
          jobId: row.id,
          userId: row.user_id,
          state,
        })
        const { data: updated } = await createAdminClient()
          .from("seedance_jobs")
          .select("*")
          .eq("id", row.id)
          .single()
        if (updated) {
          return NextResponse.json({
            job: await withPlayableUrl(updated as SeedanceJobRow),
          })
        }
      } catch (err) {
        console.error("[gemini] reconcile failed:", err)
      }
    }

    if (
      row.provider !== "gemini" &&
      row.provider_task_id &&
      (row.status === "queued" || row.status === "processing")
    ) {
      try {
        const state = await getSeedanceTask(row.provider_task_id)
        const nextStatus = mapProviderStatusToJob(state.status)

        if (
          nextStatus === "succeeded" ||
          nextStatus === "failed" ||
          nextStatus === "processing" ||
          nextStatus === "queued"
        ) {
          const admin = createAdminClient()
          const updates: Partial<SeedanceJobRow> = {
            status: nextStatus === "queued" ? "processing" : nextStatus,
          }
          if (nextStatus === "succeeded") {
            updates.output_url = state.outputUrl
            updates.error = null
          }
          if (nextStatus === "failed") {
            updates.error = state.error ?? "Generation failed"
            updates.output_url = null
          }

          const { data: updated } = await admin
            .from("seedance_jobs")
            .update(updates)
            .eq("id", row.id)
            .select("*")
            .single()

          if (updated) {
            return NextResponse.json({ job: updated })
          }
        }
      } catch (err) {
        console.error("[seedance] reconcile failed:", err)
      }
    }

    return NextResponse.json({ job: await withPlayableUrl(row) })
  } catch (err) {
    console.error("[seedance] job status error:", err)
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

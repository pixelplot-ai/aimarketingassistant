import { NextResponse } from "next/server"

import { isAdminEmail } from "@/lib/auth/admin"
import type { SeedanceJobRow } from "@/lib/seedance/types"
import { getSeedanceTask } from "@/services/byteplus/seedance"
import { createAdminClient } from "@/services/supabase/admin"
import { createClient } from "@/services/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 30

type RouteContext = {
  params: Promise<{ id: string }>
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

    return NextResponse.json({ job: row })
  } catch (err) {
    console.error("[seedance] job status error:", err)
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

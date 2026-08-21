/**
 * /api/webhooks/byteplus
 * ModelArk video-task callback. Body is unsigned — look up our job by task id,
 * then re-fetch canonical state from BytePlus before updating seedance_jobs.
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getSeedanceTask } from "@/services/byteplus/seedance"
import { createAdminClient } from "@/services/supabase/admin"

export const runtime = "nodejs"
export const maxDuration = 60

const webhookSchema = z.object({
  id: z.string().optional(),
  task_id: z.string().optional(),
  status: z.string().optional(),
})

export async function POST(request: NextRequest) {
  let rawBody: string
  try {
    rawBody = await request.text()
  } catch (error) {
    console.error("[seedance] webhook body read failed:", error)
    return NextResponse.json({ error: "Failed to read request body" }, { status: 400 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch (error) {
    console.error("[seedance] webhook body is not JSON:", error)
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const parsed = webhookSchema.safeParse(body)
  if (!parsed.success) {
    console.error("[seedance] unexpected webhook payload:", parsed.error.flatten())
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const providerTaskId =
    parsed.data.id?.trim() || parsed.data.task_id?.trim() || ""
  if (!providerTaskId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const { data: job } = await admin
      .from("seedance_jobs")
      .select("id, status")
      .eq("provider_task_id", providerTaskId)
      .maybeSingle()

    if (!job) {
      console.warn("[seedance] webhook for unknown task", { providerTaskId })
      return NextResponse.json({
        received: true,
        outcome: "ignored_unknown_job",
      })
    }

    if (
      job.status === "succeeded" ||
      job.status === "failed"
    ) {
      return NextResponse.json({
        received: true,
        outcome: "ignored_already_final",
      })
    }

    const state = await getSeedanceTask(providerTaskId)

    if (state.status === "succeeded") {
      await admin
        .from("seedance_jobs")
        .update({
          status: "succeeded",
          output_url: state.outputUrl,
          error: null,
        })
        .eq("id", job.id)

      console.info("[seedance] webhook succeeded", {
        providerTaskId,
        jobId: job.id,
      })
      return NextResponse.json({ received: true, outcome: "succeeded" })
    }

    if (state.status === "failed" || state.status === "canceled") {
      await admin
        .from("seedance_jobs")
        .update({
          status: "failed",
          error: state.error ?? "Generation failed",
          output_url: null,
        })
        .eq("id", job.id)

      console.info("[seedance] webhook failed", {
        providerTaskId,
        jobId: job.id,
        error: state.error,
      })
      return NextResponse.json({ received: true, outcome: "failed" })
    }

    await admin
      .from("seedance_jobs")
      .update({ status: "processing" })
      .eq("id", job.id)

    return NextResponse.json({ received: true, outcome: "processing" })
  } catch (error) {
    console.error("[seedance] webhook processing error:", error)
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    )
  }
}

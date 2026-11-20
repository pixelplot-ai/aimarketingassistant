/**
 * /api/webhooks/gemini
 * POST - Gemini Omni interaction receiver.
 *
 * Verifies the v1a Ed25519 signature (exempt from app auth).
 * An RS256 JWT in the same header is still accepted.
 * Answers 200 once the payload is verified, including unknown or finished
 * jobs, so Google stops retrying. A download or storage fault returns 500
 * so Google retries.
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { applyGeminiOutcome } from "@/services/gemini/completeJob"
import { getGeminiOmniTask, type GeminiClipState } from "@/services/gemini/omni"
import {
  GeminiWebhookVerificationError,
  verifyGeminiWebhook,
} from "@/services/gemini/webhookVerification"
import { createAdminClient } from "@/services/supabase/admin"

export const runtime = "nodejs"
export const maxDuration = 300

const geminiWebhookErrorCode = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((value) => {
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
    if (typeof value === "string" && value.trim()) return value.trim()
    return undefined
  })

const geminiVideoWebhookSchema = z
  .object({
    type: z.string().min(1),
    data: z
      .object({
        id: z.string().min(1),
        output_file_uri: z.string().nullish(),
        file_name: z.string().nullish(),
        error_code: geminiWebhookErrorCode,
        error_message: z.string().nullish(),
      })
      .passthrough(),
  })
  .passthrough()

export async function POST(request: NextRequest) {
  let rawBody: string
  try {
    rawBody = await request.text()
  } catch (error) {
    console.error("[gemini] webhook body read failed:", error)
    return NextResponse.json(
      { error: "Failed to read request body" },
      { status: 400 },
    )
  }

  try {
    await verifyGeminiWebhook({
      signature: request.headers.get("webhook-signature"),
      id: request.headers.get("webhook-id"),
      timestamp: request.headers.get("webhook-timestamp"),
      rawBody,
    })
  } catch (error) {
    if (error instanceof GeminiWebhookVerificationError) {
      const unavailable = error.message === "Webhook verification unavailable"
      console.error("[gemini] webhook signature rejected:", error.message)
      return NextResponse.json(
        {
          error: unavailable
            ? "Webhook verification unavailable"
            : "Invalid signature",
        },
        { status: unavailable ? 500 : 400 },
      )
    }
    console.error("[gemini] webhook verification failed:", error)
    return NextResponse.json(
      { error: "Webhook verification unavailable" },
      { status: 500 },
    )
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch (error) {
    console.error("[gemini] webhook body is not JSON:", error)
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const parsed = geminiVideoWebhookSchema.safeParse(body)
  if (!parsed.success) {
    console.error("[gemini] unexpected webhook payload:", parsed.error.flatten())
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const providerTaskId = parsed.data.data.id
  const eventType = parsed.data.type

  try {
    const admin = createAdminClient()
    const { data: job } = await admin
      .from("seedance_jobs")
      .select("id, user_id, status, provider")
      .eq("provider_task_id", providerTaskId)
      .eq("provider", "gemini")
      .maybeSingle()

    if (!job) {
      console.warn("[gemini] webhook for unknown task", { providerTaskId })
      return NextResponse.json({
        received: true,
        outcome: "ignored_unknown_job",
      })
    }

    if (job.status === "succeeded" || job.status === "failed") {
      return NextResponse.json({
        received: true,
        outcome: "ignored_already_final",
      })
    }

    const state = await clipStateFromEvent(
      eventType,
      parsed.data.data,
      providerTaskId,
    )
    const outcome = await applyGeminiOutcome({
      jobId: job.id,
      userId: job.user_id,
      state,
    })

    console.info("[gemini] webhook processed", {
      providerTaskId,
      jobId: job.id,
      eventType,
      outcome,
    })
    return NextResponse.json({ received: true, outcome })
  } catch (error) {
    console.error("[gemini] webhook processing error:", error)
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 },
    )
  }
}

async function clipStateFromEvent(
  eventType: string,
  data: {
    output_file_uri?: string | null
    error_code?: string
    error_message?: string | null
  },
  providerTaskId: string,
): Promise<GeminiClipState> {
  const webhookMessage = data.error_message?.trim() || ""
  const webhookCode = data.error_code?.trim() || ""
  const error =
    webhookMessage && webhookCode && !webhookMessage.includes(webhookCode)
      ? `${webhookCode}: ${webhookMessage}`
      : webhookMessage || webhookCode || null

  if (eventType === "interaction.failed") {
    return {
      status: "failed",
      outputUrl: null,
      outputBase64: null,
      error: error || "Generation failed",
    }
  }
  if (eventType === "interaction.cancelled") {
    return {
      status: "canceled",
      outputUrl: null,
      outputBase64: null,
      error: error || "Generation canceled",
    }
  }
  if (eventType === "video.generated" || eventType === "interaction.completed") {
    const uri = data.output_file_uri?.trim() || ""
    if (uri) {
      return {
        status: "succeeded",
        outputUrl: uri,
        outputBase64: null,
        error: null,
      }
    }
    return getGeminiOmniTask(providerTaskId)
  }

  return {
    status: "processing",
    outputUrl: null,
    outputBase64: null,
    error: null,
  }
}

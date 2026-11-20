/**
 * Gemini Omni 1.2 Flash image-to-video via the Interactions API.
 * `background` plus `webhook_config` returns immediately; the clip arrives on
 * `/api/webhooks/gemini`. Status reads the same interaction if that POST is lost.
 */

import { getGeminiApiKey } from "@/services/gemini/apiKey"

export const GEMINI_OMNI_MODEL = "gemini-omni-1.2-flash"
export const GEMINI_OMNI_MIN_SECONDS = 3
export const GEMINI_OMNI_MAX_SECONDS = 15

const INTERACTIONS_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions"
const MAX_CLIP_BYTES = 50 * 1024 * 1024

export type GeminiClipStatus = "processing" | "succeeded" | "failed" | "canceled"

export interface GeminiClipState {
  status: GeminiClipStatus
  outputUrl: string | null
  outputBase64: string | null
  error: string | null
}

interface InteractionFailure {
  message?: string
  code?: string | number
}

interface InteractionResponse {
  id?: string
  status?: string
  error?: InteractionFailure
  errors?: InteractionFailure[]
  steps?: Array<{
    content?: Array<{
      type?: string
      uri?: string
      data?: string
    }>
  }>
}

export function clampGeminiOmniSeconds(seconds: number): number {
  const ceiled = Math.ceil(seconds)
  if (!Number.isFinite(ceiled)) return 5
  return Math.min(
    GEMINI_OMNI_MAX_SECONDS,
    Math.max(GEMINI_OMNI_MIN_SECONDS, ceiled),
  )
}

export function getGeminiWebhookUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "")
  if (!base) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is not configured. Set it to your public origin so Google can call the webhook.",
    )
  }
  return `${base}/api/webhooks/gemini`
}

function toOmniAspect(ratio: string): "9:16" | "16:9" {
  if (ratio === "9:16" || ratio === "16:9") return ratio
  throw new Error("Gemini Omni only renders 9:16 and 16:9 video.")
}

function toStatus(raw: string | undefined): GeminiClipStatus {
  const status = (raw || "").toLowerCase()
  if (status === "completed" || status === "succeeded") return "succeeded"
  if (status === "failed") return "failed"
  if (status === "cancelled" || status === "canceled") return "canceled"
  return "processing"
}

function readFailure(data: InteractionResponse): string | null {
  const items = data.errors?.length ? data.errors : data.error ? [data.error] : []
  for (const item of items) {
    const message = item.message?.trim() || ""
    const code = item.code == null ? "" : String(item.code).trim()
    if (message && code && !message.includes(code)) return `${code}: ${message}`
    if (message || code) return message || code
  }
  return null
}

function readVideo(data: InteractionResponse): {
  uri: string | null
  data: string | null
} {
  for (const step of data.steps ?? []) {
    for (const part of step.content ?? []) {
      if (part.type !== "video") continue
      const uri = part.uri?.trim() || null
      const inline = part.data?.trim() || null
      if (uri || inline) return { uri, data: inline }
    }
  }
  return { uri: null, data: null }
}

async function fetchStartImage(
  url: string,
): Promise<{ bytes: Buffer; mimeType: string }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  if (!response.ok) {
    throw new Error(`Could not download the start frame (${response.status}).`)
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  if (!bytes.length) {
    throw new Error("The start frame was empty.")
  }
  const header = (response.headers.get("content-type") || "").toLowerCase()
  if (header.includes("png")) return { bytes, mimeType: "image/png" }
  if (header.includes("webp")) return { bytes, mimeType: "image/webp" }
  return { bytes, mimeType: "image/jpeg" }
}

function stateFromInteraction(data: InteractionResponse): GeminiClipState {
  const status = toStatus(data.status)
  const error = readFailure(data)
  if (status !== "succeeded") {
    return { status, outputUrl: null, outputBase64: null, error }
  }
  const video = readVideo(data)
  if (!video.uri && !video.data) {
    return {
      status: "failed",
      outputUrl: null,
      outputBase64: null,
      error: "Gemini Omni completed without a video.",
    }
  }
  return {
    status: "succeeded",
    outputUrl: video.uri,
    outputBase64: video.data,
    error: null,
  }
}

export async function startGeminiOmniTask(request: {
  prompt: string
  imageUrl: string
  aspectRatio: "9:16" | "16:9"
  durationSeconds: number
}): Promise<{ providerTaskId: string }> {
  const webhookUrl = getGeminiWebhookUrl()
  const image = await fetchStartImage(request.imageUrl)
  const seconds = clampGeminiOmniSeconds(request.durationSeconds)
  const body = {
    model: GEMINI_OMNI_MODEL,
    background: true,
    input: [
      {
        type: "image",
        data: image.bytes.toString("base64"),
        mime_type: image.mimeType,
      },
      { type: "text", text: request.prompt.trim() },
    ],
    generation_config: {
      video_config: { task: "image_to_video" },
    },
    response_format: {
      type: "video",
      aspect_ratio: toOmniAspect(request.aspectRatio),
      resolution: "720p",
      duration: `${seconds}s`,
      delivery: "uri",
    },
    webhook_config: { uris: [webhookUrl] },
  }

  let response: Response
  try {
    response = await fetch(INTERACTIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": getGeminiApiKey(),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })
  } catch (err) {
    throw new Error("Could not reach Gemini to start video generation.", {
      cause: err,
    })
  }

  const data = (await response.json()) as InteractionResponse
  if (!response.ok || !data.id) {
    throw new Error(
      data.error?.message ||
        `Gemini Omni did not accept the video (${response.status}).`,
    )
  }

  return { providerTaskId: data.id }
}

export async function getGeminiOmniTask(
  providerTaskId: string,
): Promise<GeminiClipState> {
  const response = await fetch(
    `${INTERACTIONS_URL}/${encodeURIComponent(providerTaskId)}`,
    { headers: { "x-goog-api-key": getGeminiApiKey() } },
  )
  const data = (await response.json()) as InteractionResponse
  if (!response.ok) {
    throw new Error(
      data.error?.message ||
        `Gemini Omni status failed with status ${response.status}`,
    )
  }
  return stateFromInteraction(data)
}

function isGeminiFileUrl(url: string): boolean {
  try {
    return new URL(url).hostname === "generativelanguage.googleapis.com"
  } catch {
    return false
  }
}

export async function downloadGeminiClip(source: {
  outputUrl: string | null
  outputBase64: string | null
}): Promise<{ bytes: Buffer; mimeType: string }> {
  const inline = source.outputBase64?.trim() || ""
  if (inline) {
    const bytes = Buffer.from(inline, "base64")
    if (!bytes.length || bytes.length > MAX_CLIP_BYTES) {
      throw new Error(`Gemini clip is ${bytes.length} bytes.`)
    }
    return { bytes, mimeType: "video/mp4" }
  }

  const url = source.outputUrl?.trim() || ""
  if (!url) {
    throw new Error("Gemini Omni finished without a video.")
  }

  const headers: Record<string, string> = {}
  if (isGeminiFileUrl(url)) {
    headers["x-goog-api-key"] = getGeminiApiKey()
  }
  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new Error(`Could not download the Gemini clip (${response.status}).`)
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  if (!bytes.length || bytes.length > MAX_CLIP_BYTES) {
    throw new Error(`Gemini clip is ${bytes.length} bytes.`)
  }
  const mime = response.headers.get("content-type")?.split(";")[0]?.trim()
  return {
    bytes,
    mimeType: mime?.startsWith("video/") ? mime : "video/mp4",
  }
}

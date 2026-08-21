/**
 * Seedance video generation via BytePlus ModelArk.
 * POST {baseUrl}/contents/generations/tasks
 * GET  {baseUrl}/contents/generations/tasks/{id}
 */

import {
  getByteplusArkApiKey,
  getByteplusArkBaseUrl,
  getSeedanceModelId,
  getSeedanceWebhookUrl,
  normalizeArkModelId,
} from "@/services/byteplus/config"

const TASKS_PATH = "/contents/generations/tasks"

const SEEDANCE_RATIOS = new Set([
  "16:9",
  "9:16",
  "1:1",
  "4:3",
  "3:4",
  "21:9",
])

const RATIO_ALIASES: Record<string, string> = {
  "4:5": "3:4",
  "5:4": "4:3",
}

export type SeedanceQuality = "standard" | "pro"
export type SeedanceTaskStatus =
  | "starting"
  | "processing"
  | "succeeded"
  | "failed"
  | "canceled"

export interface SeedanceStartRequest {
  prompt: string
  imageUrls: string[]
  audioUrl?: string | null
  model: string
  durationSeconds: 5 | 10
  ratio: string
  quality: SeedanceQuality
  generateAudio: boolean
}

export interface SeedanceStartResult {
  providerTaskId: string
  model: string
}

export interface SeedanceTaskState {
  status: SeedanceTaskStatus
  outputUrl: string | null
  error: string | null
}

interface ByteplusVideoTaskResponse {
  id?: string
  task_id?: string
  status?: string
  content?: {
    video_url?: string
    url?: string
  } | null
  video_url?: string
  error?:
    | {
        message?: string
        code?: string | number
      }
    | string
    | null
}

const MAX_INLINE_AUDIO_BYTES = 2 * 1024 * 1024

function isSeedanceLimitedResolution(model: string): boolean {
  return /-fast-|-mini-/i.test(model)
}

function toSeedanceResolution(
  quality: SeedanceQuality,
  model: string,
): "720p" | "1080p" {
  if (isSeedanceLimitedResolution(model) || quality !== "pro") {
    return "720p"
  }
  return "1080p"
}

function toSeedanceRatio(aspectRatio: string | undefined): string {
  const key = (aspectRatio || "9:16").trim()
  const mapped = RATIO_ALIASES[key] ?? key
  return SEEDANCE_RATIOS.has(mapped) ? mapped : "9:16"
}

function toSeedanceDuration(
  durationSeconds: number,
  hasReferenceAudio: boolean,
): number {
  return hasReferenceAudio ? -1 : durationSeconds
}

function readTaskId(data: ByteplusVideoTaskResponse): string | null {
  const id = data.id?.trim() || data.task_id?.trim()
  return id || null
}

function readVideoUrl(data: ByteplusVideoTaskResponse): string | null {
  const fromContent =
    data.content?.video_url?.trim() || data.content?.url?.trim()
  if (fromContent) return fromContent
  return data.video_url?.trim() || null
}

function readErrorMessage(
  error: ByteplusVideoTaskResponse["error"],
): string | null {
  if (typeof error === "string" && error.trim()) return error.trim()
  if (error && typeof error === "object" && error.message?.trim()) {
    return error.message.trim()
  }
  return null
}

function toTaskStatus(raw: string | undefined): SeedanceTaskStatus {
  const status = (raw || "").trim().toLowerCase()
  if (status === "succeeded" || status === "success") return "succeeded"
  if (status === "failed" || status === "error") return "failed"
  if (status === "cancelled" || status === "canceled") return "canceled"
  if (status === "running" || status === "processing") return "processing"
  return "starting"
}

function ratioPromptLine(ratio: string): string {
  if (ratio === "9:16" || ratio === "3:4") {
    return `The video MUST be ${ratio} vertical/portrait. Fill the entire ${ratio} frame. Do not generate a square 1:1 video even if @Image1 is square.`
  }
  if (ratio === "16:9" || ratio === "21:9" || ratio === "4:3") {
    return `The video MUST be ${ratio} landscape. Fill the entire ${ratio} frame. Do not generate a square 1:1 video.`
  }
  return `The video MUST be ${ratio}.`
}

function buildPrompt(input: {
  prompt: string
  ratio: string
  imageCount: number
  hasAudio: boolean
}): string {
  const ratio = toSeedanceRatio(input.ratio)
  const parts = [input.prompt.trim(), ratioPromptLine(ratio)]

  if (input.imageCount > 0) {
    const tags = Array.from(
      { length: input.imageCount },
      (_, i) => `@Image${i + 1}`,
    ).join(", ")
    parts.push(
      `Use ${tags} as identity / visual references. Match products, people, and branding from those images. They are not locked first frames — invent camera and motion around them.`,
    )
  }

  if (input.hasAudio) {
    parts.push(
      "Keep @Audio1 as the audible soundtrack of the exported video from 0s to the end. Do not mute, drop, or omit @Audio1. Never output a silent video.",
    )
  } else {
    parts.push(
      "Generate synchronized native audio including spoken voiceover from the prompt when relevant, plus foley and ambient sound. Do not output a silent video.",
    )
  }

  return parts.filter(Boolean).join("\n\n")
}

async function toSeedanceAudioUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return url
    const buffer = Buffer.from(await response.arrayBuffer())
    if (!buffer.length || buffer.byteLength > MAX_INLINE_AUDIO_BYTES) {
      return url
    }
    const mime = response.headers.get("content-type")?.split(";")[0]?.trim()
    const seedanceMime = mime?.includes("wav") ? "audio/wav" : "audio/mpeg"
    return `data:${seedanceMime};base64,${buffer.toString("base64")}`
  } catch (err) {
    console.error("[seedance] could not inline reference audio:", err)
    return url
  }
}

function mapHttpError(status: number, data: ByteplusVideoTaskResponse): string {
  const detail = readErrorMessage(data.error)

  if (status === 401) {
    return (
      detail ||
      "BytePlus rejected the API key (401). Check BYTEPLUS_ARK_API_KEY."
    )
  }
  if (status === 403) {
    return (
      detail ||
      "BytePlus denied the request (403). Activate Seedance in the ModelArk console, or check account balance."
    )
  }
  if (status === 400) {
    return (
      detail ||
      "BytePlus rejected the video request (400). Check SEEDANCE_MODEL_ID and prompt inputs."
    )
  }
  return detail || `Seedance video generation failed with status ${status}`
}

async function parseTaskResponse(
  response: Response,
  context: string,
): Promise<ByteplusVideoTaskResponse> {
  const rawText = await response.text()
  try {
    return JSON.parse(rawText) as ByteplusVideoTaskResponse
  } catch (err) {
    console.error(`[seedance] ${context} returned non-JSON:`, {
      status: response.status,
      err,
    })
    throw new Error(
      `BytePlus returned an unreadable response (status ${response.status}).`,
    )
  }
}

export async function startSeedanceTask(
  request: SeedanceStartRequest,
): Promise<SeedanceStartResult> {
  const apiKey = getByteplusArkApiKey()
  const baseUrl = getByteplusArkBaseUrl()
  const model = normalizeArkModelId(
    request.model.trim() || getSeedanceModelId(),
  )
  const imageUrls = request.imageUrls.map((url) => url.trim()).filter(Boolean)
  const referenceAudioUrl = request.audioUrl?.trim()
    ? await toSeedanceAudioUrl(request.audioUrl.trim())
    : ""

  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: buildPrompt({
        prompt: request.prompt,
        ratio: request.ratio,
        imageCount: imageUrls.length,
        hasAudio: Boolean(referenceAudioUrl),
      }),
    },
  ]

  for (const url of imageUrls) {
    content.push({
      type: "image_url",
      image_url: { url },
      role: "reference_image",
    })
  }

  if (referenceAudioUrl) {
    content.push({
      type: "audio_url",
      audio_url: { url: referenceAudioUrl },
      role: "reference_audio",
    })
  }

  const duration = toSeedanceDuration(
    request.durationSeconds,
    Boolean(referenceAudioUrl),
  )

  const body: Record<string, unknown> = {
    model,
    content,
    ratio: toSeedanceRatio(request.ratio),
    resolution: toSeedanceResolution(request.quality, model),
    duration,
    generate_audio: request.generateAudio !== false,
    watermark: false,
    callback_url: getSeedanceWebhookUrl(),
  }

  console.info("[seedance] start", {
    model,
    quality: request.quality,
    durationSeconds: request.durationSeconds,
    seedanceDuration: duration,
    ratio: body.ratio,
    resolution: body.resolution,
    generateAudio: request.generateAudio !== false,
    referenceAudio: Boolean(referenceAudioUrl),
    imageCount: imageUrls.length,
  })

  let response: Response
  try {
    response = await fetch(`${baseUrl}${TASKS_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    console.error("[seedance] request failed:", err)
    throw new Error("Could not reach BytePlus to start video generation.")
  }

  const data = await parseTaskResponse(response, "start")

  if (!response.ok) {
    const message = mapHttpError(response.status, data)
    console.error("[seedance] start rejected:", {
      status: response.status,
      message,
    })
    throw new Error(message)
  }

  const providerTaskId = readTaskId(data)
  if (!providerTaskId) {
    throw new Error("BytePlus did not return a video task id.")
  }

  return { providerTaskId, model }
}

export async function getSeedanceTask(
  providerTaskId: string,
): Promise<SeedanceTaskState> {
  const apiKey = getByteplusArkApiKey()
  const baseUrl = getByteplusArkBaseUrl()

  let response: Response
  try {
    response = await fetch(
      `${baseUrl}${TASKS_PATH}/${encodeURIComponent(providerTaskId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    )
  } catch (err) {
    console.error("[seedance] task lookup failed:", err)
    throw new Error("Could not reach BytePlus to check the render status.")
  }

  if (response.status === 404) {
    return {
      status: "failed",
      outputUrl: null,
      error: "BytePlus no longer has a record of this render.",
    }
  }

  const data = await parseTaskResponse(response, "lookup")

  if (!response.ok) {
    throw new Error(mapHttpError(response.status, data))
  }

  const status = toTaskStatus(data.status)

  return {
    status,
    outputUrl: status === "succeeded" ? readVideoUrl(data) : null,
    error: readErrorMessage(data.error),
  }
}

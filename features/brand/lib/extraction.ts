import OpenAI from "openai"

import {
  BRAND_VALUES_OPTIONS,
  BRAND_VOICE_OPTIONS,
  CTA_OPTIONS,
  WRITING_STYLE_OPTIONS,
} from "@/features/brand/constants"
import { AppError } from "@/lib/errors/app-error"
import type { BrandProfileFormValues } from "@/lib/validations/brand-profile"
import { getGeminiClient } from "@/services/ai/gemini-client"
import {
  DEFAULT_GEMINI_TEXT_MODEL,
  formatGeminiApiError,
  resolveGeminiTextModel,
} from "@/services/ai/gemini-models"
import { hasEnvOpenAiApiKey } from "@/services/ai/env"
import type { SettingsBundle } from "@/types/app"

export type BrandExtractResult = Omit<BrandProfileFormValues, "id">

function buildBrandExtractionPrompts(pageText: string) {
  const system =
    "You are a brand strategist. Analyze webpage content and return valid JSON only — no markdown, no code fences, no extra text."

  const user = `From the following webpage content, extract brand profile information for social media marketing.

Return a JSON object with exactly these fields:
- brand_name: string (company or brand name, max 200 chars)
- business_description: string (what the business does, max 2000 chars)
- industry: string (industry or niche, max 200 chars)
- target_audience: string (who they serve, max 2000 chars)
- brand_voice: string[] (pick 1-3 from: ${BRAND_VOICE_OPTIONS.join(", ")})
- writing_style: string[] (pick 1-3 from: ${WRITING_STYLE_OPTIONS.join(", ")})
- brand_values: string[] (pick 1-3 from: ${BRAND_VALUES_OPTIONS.join(", ")})
- preferred_ctas: string[] (pick 1-3 from: ${CTA_OPTIONS.join(", ")})
- keywords: string[] (5-10 SEO keywords relevant to the brand)
- avoid_words: string[] (words to avoid in copy; empty array if none obvious)
- competitors: string[] (competitor names if mentioned; empty array otherwise)
- color_primary: string (hex color e.g. #2563eb — infer from brand if possible)
- color_secondary: string (hex color)
- color_accent: string (hex color)

Rules:
- Use only the exact enum labels listed above for brand_voice, writing_style, brand_values, and preferred_ctas
- Hex colors must be 6-digit format with leading #
- Infer conservatively when information is missing

Webpage content:
${pageText.slice(0, 12000)}`

  return { system, user }
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const text = raw.trim()

  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    const stripped = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim()

    const firstBrace = stripped.indexOf("{")
    const lastBrace = stripped.lastIndexOf("}")
    if (firstBrace === -1 || lastBrace <= firstBrace) {
      throw new AppError({
        code: "EXTERNAL_SERVICE",
        message: `Failed to parse AI response: ${text.slice(0, 200)}`,
        userMessage: "AI returned an unexpected format. Please try again.",
      })
    }

    parsed = JSON.parse(stripped.slice(firstBrace, lastBrace + 1))
  }

  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      throw new AppError({
        code: "EXTERNAL_SERVICE",
        message: "Failed to parse nested AI response",
        userMessage: "AI returned an unexpected format. Please try again.",
      })
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AppError({
      code: "EXTERNAL_SERVICE",
      message: "AI response was not a JSON object",
      userMessage: "AI returned an unexpected format. Please try again.",
    })
  }

  return parsed as Record<string, unknown>
}

function pickEnumValues<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T[],
): T[] {
  if (!Array.isArray(value)) {
    return fallback
  }

  const picked = value.filter(
    (item): item is T =>
      typeof item === "string" && options.includes(item as T),
  )

  return picked.length > 0 ? picked.slice(0, 3) : fallback
}

function pickStringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems)
}

function parseHexColor(value: unknown, fallback: string): string {
  if (typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value.trim())) {
    return value.trim()
  }

  return fallback
}

function parseString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback
}

export function normalizeBrandExtraction(
  data: Record<string, unknown>,
  defaults: BrandProfileFormValues,
): BrandExtractResult {
  return {
    brand_name: parseString(data.brand_name, defaults.brand_name),
    business_description: parseString(
      data.business_description,
      defaults.business_description,
    ),
    industry: parseString(data.industry, defaults.industry),
    target_audience: parseString(data.target_audience, defaults.target_audience),
    brand_voice: pickEnumValues(data.brand_voice, BRAND_VOICE_OPTIONS, [
      defaults.brand_voice[0] ?? "Professional",
    ]),
    writing_style: pickEnumValues(data.writing_style, WRITING_STYLE_OPTIONS, [
      defaults.writing_style[0] ?? "Marketing",
    ]),
    brand_values: pickEnumValues(data.brand_values, BRAND_VALUES_OPTIONS, [
      defaults.brand_values[0] ?? "Trust",
    ]),
    preferred_ctas: pickEnumValues(data.preferred_ctas, CTA_OPTIONS, [
      defaults.preferred_ctas[0] ?? "Learn More",
    ]),
    keywords: pickStringArray(data.keywords, 10),
    avoid_words: pickStringArray(data.avoid_words, 20),
    competitors: pickStringArray(data.competitors, 10),
    color_primary: parseHexColor(data.color_primary, defaults.color_primary),
    color_secondary: parseHexColor(
      data.color_secondary,
      defaults.color_secondary,
    ),
    color_accent: parseHexColor(data.color_accent, defaults.color_accent),
  }
}

async function extractWithOpenAi(
  pageText: string,
  model: string,
): Promise<Record<string, unknown>> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new AppError({
      code: "EXTERNAL_SERVICE",
      message: "OPENAI_API_KEY is not configured",
      userMessage: "OpenAI is not configured. Add OPENAI_API_KEY to your environment.",
    })
  }

  const { system, user } = buildBrandExtractionPrompts(pageText)
  const client = new OpenAI({ apiKey })

  const response = await client.chat.completions.create({
    model,
    temperature: 0.3,
    max_tokens: 4096,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  })

  const raw = response.choices[0]?.message?.content?.trim()
  if (!raw) {
    throw new AppError({
      code: "EXTERNAL_SERVICE",
      message: "OpenAI returned an empty response",
      userMessage: "AI extraction returned no results. Please try again.",
    })
  }

  return parseJsonObject(raw)
}

async function extractWithGemini(
  pageText: string,
  model: string,
): Promise<Record<string, unknown>> {
  const { system, user } = buildBrandExtractionPrompts(pageText)
  const genAI = getGeminiClient()
  const geminiModel = genAI.getGenerativeModel({
    model: resolveGeminiTextModel(model),
    systemInstruction: system,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    } as Record<string, unknown>,
  })

  try {
    const result = await geminiModel.generateContent(user)
    const raw = result.response.text()?.trim()

    if (!raw) {
      throw new AppError({
        code: "EXTERNAL_SERVICE",
        message: "Gemini returned an empty response",
        userMessage: "AI extraction returned no results. Please try again.",
      })
    }

    return parseJsonObject(raw)
  } catch (error) {
    if (AppError.isAppError(error)) {
      throw error
    }

    throw new AppError({
      code: "EXTERNAL_SERVICE",
      message: error instanceof Error ? error.message : "Gemini request failed",
      userMessage: formatGeminiApiError(error),
      cause: error,
    })
  }
}

export async function extractBrandInfoFromPageText(
  pageText: string,
  settings: SettingsBundle | null,
  defaults: BrandProfileFormValues,
): Promise<BrandExtractResult> {
  const provider = settings?.text_ai_provider ?? "gemini"

  const raw =
    provider === "openai" && hasEnvOpenAiApiKey()
      ? await extractWithOpenAi(
          pageText,
          settings?.openai_model ?? "gpt-4o-mini",
        )
      : await extractWithGemini(
          pageText,
          settings?.gemini_model ?? DEFAULT_GEMINI_TEXT_MODEL,
        )

  return normalizeBrandExtraction(raw, defaults)
}

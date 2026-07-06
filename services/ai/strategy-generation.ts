import OpenAI from "openai"

import { AppError } from "@/lib/errors/app-error"
import {
  parseStrategySteps,
  strategyResponseSchema,
  validateGeneratedStrategy,
  type StrategyContentMode,
  type StrategyStep,
} from "@/lib/validations/marketing-campaign"
import { getGeminiClient } from "@/services/ai/gemini-client"
import {
  formatGeminiApiError,
  resolveGeminiTextModel,
} from "@/services/ai/gemini-models"
import { logAiGeneration } from "@/services/ai/guards"
import { resolveTextProvider } from "@/services/ai/text"
import {
  buildStrategyPrompt,
  type BuildStrategyPromptInput,
} from "@/services/ai/strategy-prompt-builder"
import type { BrandProfileRow, SettingsBundle } from "@/types/app"

export type GenerateStrategyInput = BuildStrategyPromptInput & {
  settings: SettingsBundle
  brandProfile: BrandProfileRow | null
  campaignId?: string
}

export type GenerateStrategyResult = {
  steps: StrategyStep[]
  tokensUsed: number | null
  promptSummary: string
}

function parseStrategyJson(raw: string): StrategyStep[] {
  const text = raw.trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      throw new AppError({
        code: "EXTERNAL_SERVICE",
        message: "Failed to parse strategy JSON",
        userMessage: "AI returned an invalid strategy format. Please try again.",
      })
    }
    parsed = JSON.parse(match[0])
  }

  const response = strategyResponseSchema.safeParse(parsed)
  if (!response.success) {
    throw new AppError({
      code: "EXTERNAL_SERVICE",
      message: response.error.message,
      userMessage: "AI returned an invalid strategy format. Please try again.",
    })
  }

  return response.data.steps
}

async function generateWithOpenAi(
  prompt: { system: string; user: string; summary: string },
  settings: SettingsBundle,
): Promise<{ raw: string; tokensUsed: number | null }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new AppError({
      code: "EXTERNAL_SERVICE",
      message: "OPENAI_API_KEY is not configured",
      userMessage: "OpenAI is not configured. Add OPENAI_API_KEY to your environment.",
    })
  }

  const client = new OpenAI({ apiKey })
  const response = await client.chat.completions.create({
    model: settings.openai_model,
    temperature: settings.openai_temperature,
    max_tokens: Math.max(settings.openai_max_tokens, 4096),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
  })

  const raw = response.choices[0]?.message?.content?.trim()
  if (!raw) {
    throw new AppError({
      code: "EXTERNAL_SERVICE",
      message: "OpenAI returned an empty response",
      userMessage: "AI did not return a strategy. Please try again.",
    })
  }

  return { raw, tokensUsed: response.usage?.total_tokens ?? null }
}

async function generateWithGemini(
  prompt: { system: string; user: string; summary: string },
  settings: SettingsBundle,
): Promise<{ raw: string; tokensUsed: number | null }> {
  const genAI = getGeminiClient()
  const model = genAI.getGenerativeModel({
    model: resolveGeminiTextModel(settings.gemini_model),
    systemInstruction: prompt.system,
    generationConfig: {
      temperature: settings.openai_temperature,
      maxOutputTokens: Math.max(settings.openai_max_tokens, 4096),
      responseMimeType: "application/json",
    },
  })

  try {
    const result = await model.generateContent(prompt.user)
    const raw = result.response.text()?.trim()

    if (!raw) {
      throw new AppError({
        code: "EXTERNAL_SERVICE",
        message: "Gemini returned an empty response",
        userMessage: "AI did not return a strategy. Please try again.",
      })
    }

    return {
      raw,
      tokensUsed: result.response.usageMetadata?.totalTokenCount ?? null,
    }
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

async function callProviderOnce(
  input: GenerateStrategyInput,
): Promise<{ raw: string; tokensUsed: number | null; promptSummary: string }> {
  const prompt = buildStrategyPrompt(input)
  const provider = resolveTextProvider(input.settings)

  const result =
    provider === "gemini"
      ? await generateWithGemini(prompt, input.settings)
      : await generateWithOpenAi(prompt, input.settings)

  return { ...result, promptSummary: prompt.summary }
}

export async function generateMarketingStrategy(
  input: GenerateStrategyInput,
): Promise<GenerateStrategyResult> {
  let lastError: AppError | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { raw, tokensUsed, promptSummary } = await callProviderOnce(input)
      const steps = parseStrategyJson(raw)
      const validation = validateGeneratedStrategy(
        steps,
        input.durationDays,
        input.contentMode,
      )

      if (!validation.valid) {
        throw new AppError({
          code: "EXTERNAL_SERVICE",
          message: validation.error,
          userMessage: validation.error,
        })
      }

      await logAiGeneration({
        operation: "generate_marketing_strategy",
        provider: resolveTextProvider(input.settings),
        brandProfileId: input.brandProfile?.id ?? null,
        postId: null,
        promptSummary,
        tokensUsed,
        metadata: {
          campaign_id: input.campaignId,
          duration_days: input.durationDays,
          step_count: validation.steps.length,
        },
      })

      return { steps: validation.steps, tokensUsed, promptSummary }
    } catch (error) {
      if (AppError.isAppError(error)) {
        lastError = error
        if (attempt === 0) {
          continue
        }
        throw error
      }

      throw new AppError({
        code: "EXTERNAL_SERVICE",
        message: error instanceof Error ? error.message : "Strategy generation failed",
        userMessage: "Failed to generate marketing strategy. Please try again.",
        cause: error,
      })
    }
  }

  throw lastError ?? new AppError({
    code: "EXTERNAL_SERVICE",
    message: "Strategy generation failed after retries",
    userMessage: "Failed to generate marketing strategy. Please try again.",
  })
}

export { parseStrategySteps }

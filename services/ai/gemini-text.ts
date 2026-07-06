import { AppError } from "@/lib/errors/app-error"
import { getGeminiClient } from "@/services/ai/gemini-client"
import {
  formatGeminiApiError,
  resolveGeminiTextModel,
} from "@/services/ai/gemini-models"
import { buildPrompt } from "@/services/ai/prompt-builder"
import type {
  AiTextOperation,
  TextCompletionContext,
  TextCompletionResult,
} from "@/services/ai/types"

async function runTextOperation(
  operation: AiTextOperation,
  context: TextCompletionContext,
): Promise<TextCompletionResult> {
  const prompt = buildPrompt({
    brandProfile: context.brandProfile,
    postContent: context.postContent,
    platformIds: context.platformIds,
    platformNames: context.platformNames,
    userInstruction: context.userInstruction,
    operation,
    targetLanguage: context.targetLanguage,
    tone: context.tone,
    defaultTextPrompt: context.settings.default_text_prompt,
    defaultTextLengthPrompt: context.settings.default_text_length_prompt,
    productContext: context.productContext,
    strategyStep: context.strategyStep,
  })

  const genAI = getGeminiClient()
  const model = genAI.getGenerativeModel({
    model: resolveGeminiTextModel(context.settings.gemini_model),
    systemInstruction: prompt.system,
    generationConfig: {
      temperature: context.settings.openai_temperature,
      maxOutputTokens: context.settings.openai_max_tokens,
    },
  })

  try {
    const result = await model.generateContent(prompt.user)
    const text = result.response.text()?.trim()

    if (!text) {
      throw new AppError({
        code: "EXTERNAL_SERVICE",
        message: "Gemini returned an empty response",
        userMessage: "AI did not return any content. Please try again.",
      })
    }

    return {
      text,
      tokensUsed: result.response.usageMetadata?.totalTokenCount ?? null,
      promptSummary: prompt.summary,
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

export async function generateCaption(
  context: TextCompletionContext,
): Promise<TextCompletionResult> {
  return runTextOperation("generate_caption", context)
}

export async function rewrite(
  context: TextCompletionContext,
): Promise<TextCompletionResult> {
  return runTextOperation("rewrite", context)
}

export async function improveWriting(
  context: TextCompletionContext,
): Promise<TextCompletionResult> {
  return runTextOperation("improve_writing", context)
}

export async function generateCta(
  context: TextCompletionContext,
): Promise<TextCompletionResult> {
  return runTextOperation("generate_cta", context)
}

export async function generateHashtags(
  context: TextCompletionContext,
): Promise<TextCompletionResult> {
  return runTextOperation("generate_hashtags", context)
}

export async function translate(
  context: TextCompletionContext & { targetLanguage: string },
): Promise<TextCompletionResult> {
  return runTextOperation("translate", context)
}

export async function changeTone(
  context: TextCompletionContext & { tone: string },
): Promise<TextCompletionResult> {
  return runTextOperation("change_tone", context)
}

export async function summarize(
  context: TextCompletionContext,
): Promise<TextCompletionResult> {
  return runTextOperation("summarize", context)
}

export async function expand(
  context: TextCompletionContext,
): Promise<TextCompletionResult> {
  return runTextOperation("expand", context)
}

export async function shorten(
  context: TextCompletionContext,
): Promise<TextCompletionResult> {
  return runTextOperation("shorten", context)
}

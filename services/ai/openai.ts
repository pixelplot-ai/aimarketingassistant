import OpenAI from "openai"

import { AppError } from "@/lib/errors/app-error"
import { buildPrompt } from "@/services/ai/prompt-builder"
import type {
  AiTextOperation,
  TextCompletionContext,
  TextCompletionResult,
} from "@/services/ai/types"

function getOpenAiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new AppError({
      code: "EXTERNAL_SERVICE",
      message: "OPENAI_API_KEY is not configured",
      userMessage: "OpenAI is not configured. Add OPENAI_API_KEY to your environment.",
    })
  }

  return new OpenAI({ apiKey })
}

type CompletionContext = TextCompletionContext

async function runTextOperation(
  operation: AiTextOperation,
  context: CompletionContext,
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

  const client = getOpenAiClient()

  try {
    const response = await client.chat.completions.create({
      model: context.settings.openai_model,
      temperature: context.settings.openai_temperature,
      max_tokens: context.settings.openai_max_tokens,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
    })

    const text = response.choices[0]?.message?.content?.trim()

    if (!text) {
      throw new AppError({
        code: "EXTERNAL_SERVICE",
        message: "OpenAI returned an empty response",
        userMessage: "AI did not return any content. Please try again.",
      })
    }

    return {
      text,
      tokensUsed: response.usage?.total_tokens ?? null,
      promptSummary: prompt.summary,
    }
  } catch (error) {
    if (AppError.isAppError(error)) {
      throw error
    }

    throw new AppError({
      code: "EXTERNAL_SERVICE",
      message: error instanceof Error ? error.message : "OpenAI request failed",
      userMessage: "AI text generation failed. Please try again.",
      cause: error,
    })
  }
}

export async function generateCaption(
  context: CompletionContext,
): Promise<TextCompletionResult> {
  return runTextOperation("generate_caption", context)
}

export async function rewrite(
  context: CompletionContext,
): Promise<TextCompletionResult> {
  return runTextOperation("rewrite", context)
}

export async function improveWriting(
  context: CompletionContext,
): Promise<TextCompletionResult> {
  return runTextOperation("improve_writing", context)
}

export async function generateCta(
  context: CompletionContext,
): Promise<TextCompletionResult> {
  return runTextOperation("generate_cta", context)
}

export async function generateHashtags(
  context: CompletionContext,
): Promise<TextCompletionResult> {
  return runTextOperation("generate_hashtags", context)
}

export async function translate(
  context: CompletionContext & { targetLanguage: string },
): Promise<TextCompletionResult> {
  return runTextOperation("translate", context)
}

export async function changeTone(
  context: CompletionContext & { tone: string },
): Promise<TextCompletionResult> {
  return runTextOperation("change_tone", context)
}

export async function summarize(
  context: CompletionContext,
): Promise<TextCompletionResult> {
  return runTextOperation("summarize", context)
}

export async function expand(
  context: CompletionContext,
): Promise<TextCompletionResult> {
  return runTextOperation("expand", context)
}

export async function shorten(
  context: CompletionContext,
): Promise<TextCompletionResult> {
  return runTextOperation("shorten", context)
}

export type { TextCompletionContext as CompletionContext }

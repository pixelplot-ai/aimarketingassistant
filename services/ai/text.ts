import * as geminiText from "@/services/ai/gemini-text"
import * as openaiText from "@/services/ai/openai"
import type { TextCompletionContext, TextCompletionResult } from "@/services/ai/types"
import type { SettingsBundle } from "@/types/app"
import type { Enums } from "@/types/database"

type TextProvider = Enums<"ai_provider">

export function resolveTextProvider(settings: SettingsBundle): TextProvider {
  return settings.text_ai_provider ?? "gemini"
}

function getProviderModule(settings: SettingsBundle) {
  return resolveTextProvider(settings) === "gemini" ? geminiText : openaiText
}

export async function generateCaption(
  context: TextCompletionContext,
): Promise<TextCompletionResult> {
  return getProviderModule(context.settings).generateCaption(context)
}

export async function rewrite(
  context: TextCompletionContext,
): Promise<TextCompletionResult> {
  return getProviderModule(context.settings).rewrite(context)
}

export async function improveWriting(
  context: TextCompletionContext,
): Promise<TextCompletionResult> {
  return getProviderModule(context.settings).improveWriting(context)
}

export async function generateCta(
  context: TextCompletionContext,
): Promise<TextCompletionResult> {
  return getProviderModule(context.settings).generateCta(context)
}

export async function generateHashtags(
  context: TextCompletionContext,
): Promise<TextCompletionResult> {
  return getProviderModule(context.settings).generateHashtags(context)
}

export async function translate(
  context: TextCompletionContext & { targetLanguage: string },
): Promise<TextCompletionResult> {
  return getProviderModule(context.settings).translate(context)
}

export async function changeTone(
  context: TextCompletionContext & { tone: string },
): Promise<TextCompletionResult> {
  return getProviderModule(context.settings).changeTone(context)
}

export async function summarize(
  context: TextCompletionContext,
): Promise<TextCompletionResult> {
  return getProviderModule(context.settings).summarize(context)
}

export async function expand(
  context: TextCompletionContext,
): Promise<TextCompletionResult> {
  return getProviderModule(context.settings).expand(context)
}

export async function shorten(
  context: TextCompletionContext,
): Promise<TextCompletionResult> {
  return getProviderModule(context.settings).shorten(context)
}

export type { TextCompletionContext }

import type { SettingsBundle } from "@/types/app"
import type {
  AiSettingsFormValues,
  AppSettingsFormValues,
} from "@/lib/validations/settings"
import {
  GEMINI_IMAGE_SIZE_OPTIONS,
  GEMINI_IMAGE_STYLE_OPTIONS,
  GEMINI_MODEL_OPTIONS,
  OPENAI_MODEL_OPTIONS,
  TEXT_AI_PROVIDER_OPTIONS,
} from "@/lib/validations/settings"
import {
  DEFAULT_GEMINI_TEXT_MODEL,
  resolveGeminiTextModel,
} from "@/services/ai/gemini-models"
import { hasEnvOpenAiApiKey } from "@/services/ai/env"

function normalizeEnum<const T extends readonly string[]>(
  value: string | null | undefined,
  options: T,
  fallback: T[number],
): T[number] {
  if (value && options.includes(value as T[number])) {
    return value as T[number]
  }

  return fallback
}

function normalizeGeminiModel(
  value: string | null | undefined,
): AiSettingsFormValues["gemini_model"] {
  const resolved = resolveGeminiTextModel(value ?? "")
  return normalizeEnum(resolved, GEMINI_MODEL_OPTIONS, DEFAULT_GEMINI_TEXT_MODEL)
}

export function mapSettingsToAiForm(
  settings: SettingsBundle,
  options?: { openAiAvailable?: boolean },
): AiSettingsFormValues {
  const openAiAvailable = options?.openAiAvailable ?? hasEnvOpenAiApiKey()
  let textAiProvider = normalizeEnum(
    settings.text_ai_provider,
    TEXT_AI_PROVIDER_OPTIONS,
    "gemini",
  )

  if (textAiProvider === "openai" && !openAiAvailable) {
    textAiProvider = "gemini"
  }

  return {
    text_ai_provider: textAiProvider,
    openai_model: normalizeEnum(
      settings.openai_model,
      OPENAI_MODEL_OPTIONS,
      "gpt-4o-mini",
    ),
    openai_temperature: Number(settings.openai_temperature),
    openai_max_tokens: Number(settings.openai_max_tokens),
    gemini_model: normalizeGeminiModel(settings.gemini_model),
    gemini_image_size: normalizeEnum(
      settings.gemini_image_size,
      GEMINI_IMAGE_SIZE_OPTIONS,
      "1024x1024",
    ),
    gemini_image_style: normalizeEnum(
      settings.gemini_image_style,
      GEMINI_IMAGE_STYLE_OPTIONS,
      "natural",
    ),
    default_text_prompt: settings.default_text_prompt ?? "",
    default_image_prompt: settings.default_image_prompt ?? "",
    default_text_length_prompt: settings.default_text_length_prompt ?? "",
  }
}

export function mapSettingsToAppForm(
  settings: SettingsBundle,
  enabledPlatformIds: string[],
): AppSettingsFormValues {
  const validDefaultPlatforms = settings.default_platform_ids.filter((id) =>
    enabledPlatformIds.includes(id),
  )

  return {
    timezone: settings.timezone,
    date_format:
      settings.date_format as AppSettingsFormValues["date_format"],
    default_post_status: settings.default_post_status,
    default_platform_ids: validDefaultPlatforms,
  }
}

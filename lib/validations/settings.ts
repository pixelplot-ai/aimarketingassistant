import { z } from "zod"

import type { Enums } from "@/types/database"
import {
  DEFAULT_IMAGE_PROMPT,
  DEFAULT_TEXT_LENGTH_PROMPT,
  DEFAULT_TEXT_PROMPT,
} from "@/services/ai/default-prompts"

const postStatusSchema = z.enum([
  "draft",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "cancelled",
]) satisfies z.ZodType<Enums<"post_status">>

export const TEXT_AI_PROVIDER_OPTIONS = ["openai", "gemini"] as const

export const OPENAI_MODEL_OPTIONS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-3.5-turbo",
] as const

export const GEMINI_MODEL_OPTIONS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
] as const

export const GEMINI_IMAGE_SIZE_OPTIONS = [
  "1024x1024",
  "1024x768",
  "768x1024",
] as const

export const GEMINI_IMAGE_STYLE_OPTIONS = [
  "natural",
  "vivid",
  "minimal",
  "bold",
  "photographic",
] as const

export const DATE_FORMAT_OPTIONS = [
  "MM/dd/yyyy",
  "dd/MM/yyyy",
  "yyyy-MM-dd",
  "MMM d, yyyy",
] as const

export const DEFAULT_TIMEZONE = "Europe/Bucharest"

export const TIMEZONE_OPTIONS = [
  DEFAULT_TIMEZONE,
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
] as const

export const aiSettingsSchema = z.object({
  text_ai_provider: z.enum(TEXT_AI_PROVIDER_OPTIONS),
  openai_model: z.enum(OPENAI_MODEL_OPTIONS),
  openai_temperature: z
    .number()
    .min(0, "Minimum temperature is 0")
    .max(2, "Maximum temperature is 2"),
  openai_max_tokens: z
    .number()
    .int()
    .min(256, "Minimum is 256 tokens")
    .max(4096, "Maximum is 4096 tokens"),
  gemini_model: z.enum(GEMINI_MODEL_OPTIONS),
  gemini_image_size: z.enum(GEMINI_IMAGE_SIZE_OPTIONS),
  gemini_image_style: z.enum(GEMINI_IMAGE_STYLE_OPTIONS),
  default_text_prompt: z
    .string()
    .max(4000, "Text prompt must be 4000 characters or fewer"),
  default_image_prompt: z
    .string()
    .max(4000, "Image prompt must be 4000 characters or fewer"),
  default_text_length_prompt: z
    .string()
    .max(2000, "Length prompt must be 2000 characters or fewer"),
})

export { DEFAULT_IMAGE_PROMPT, DEFAULT_TEXT_LENGTH_PROMPT, DEFAULT_TEXT_PROMPT }

export const appSettingsSchema = z.object({
  timezone: z.string().min(1, "Timezone is required"),
  date_format: z.enum(DATE_FORMAT_OPTIONS),
  default_post_status: postStatusSchema,
  default_platform_ids: z.array(z.string().min(1)),
})

export type AiSettingsFormValues = z.infer<typeof aiSettingsSchema>
export type AppSettingsFormValues = z.infer<typeof appSettingsSchema>
export type AiSettingsInput = z.input<typeof aiSettingsSchema>
export type AppSettingsInput = z.input<typeof appSettingsSchema>

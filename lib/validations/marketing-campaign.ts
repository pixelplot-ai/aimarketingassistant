import { z } from "zod"

export const STRATEGY_CONTENT_MODES = ["text_only", "text_and_image"] as const

export type StrategyContentMode = (typeof STRATEGY_CONTENT_MODES)[number]

export const STRATEGY_CONTENT_MODE_LABELS: Record<StrategyContentMode, string> = {
  text_only: "Text only",
  text_and_image: "Text + image",
}

export const STRATEGY_ACTIVE_CONTENT_TYPES = ["text_post", "image_post"] as const

export type StrategyActiveContentType =
  (typeof STRATEGY_ACTIVE_CONTENT_TYPES)[number]

/** Legacy content types kept for existing strategies. New AI strategies use text_post / image_post only. */
export const STRATEGY_CONTENT_TYPES = [
  ...STRATEGY_ACTIVE_CONTENT_TYPES,
  "carousel",
  "reel",
  "story",
  "video",
  "thread",
  "poll",
] as const

export type StrategyContentType = (typeof STRATEGY_CONTENT_TYPES)[number]

export const STRATEGY_CONTENT_TYPE_LABELS: Record<StrategyContentType, string> = {
  text_post: "Text Post",
  image_post: "Image Post",
  carousel: "Carousel",
  reel: "Reel",
  story: "Story",
  video: "Video",
  thread: "Thread",
  poll: "Poll",
}

export function getAllowedContentTypes(
  mode: StrategyContentMode,
): StrategyActiveContentType[] {
  return mode === "text_only" ? ["text_post"] : ["text_post", "image_post"]
}

export function inferContentModeFromSteps(steps: StrategyStep[]): StrategyContentMode {
  if (
    steps.length > 0 &&
    steps.every((step) => step.content_type === "text_post")
  ) {
    return "text_only"
  }

  return "text_and_image"
}

export const strategyStepSchema = z.object({
  day: z.number().int().min(1).max(30),
  content_type: z.enum(STRATEGY_CONTENT_TYPES),
  topic: z.string().min(1).max(500),
  objective: z.string().min(1).max(500),
  product_reference: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  completed: z.boolean(),
})

export type StrategyStep = z.infer<typeof strategyStepSchema>

export const strategyResponseSchema = z.object({
  steps: z.array(strategyStepSchema),
})

export const campaignFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  duration_days: z
    .number()
    .int("Duration must be a whole number")
    .min(1, "Minimum duration is 1 day")
    .max(30, "Maximum duration is 30 days"),
  campaign_goal: z
    .string()
    .min(1, "Campaign goal is required")
    .max(2000, "Campaign goal is too long"),
  target_audience: z.string().max(1000, "Target audience is too long").optional(),
  seasonality: z.string().max(500, "Seasonality is too long").optional(),
  extra_instructions: z
    .string()
    .max(2000, "Extra instructions are too long")
    .optional(),
  product_ids: z.array(z.string().uuid()),
})

export type CampaignFormValues = z.infer<typeof campaignFormSchema>

export function parseStrategySteps(raw: unknown): StrategyStep[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .map((item) => {
      const parsed = strategyStepSchema.safeParse(item)
      return parsed.success ? parsed.data : null
    })
    .filter((step): step is StrategyStep => step !== null)
}

export function validateGeneratedStrategy(
  steps: StrategyStep[],
  durationDays: number,
  contentMode: StrategyContentMode = "text_and_image",
): { valid: true; steps: StrategyStep[] } | { valid: false; error: string } {
  if (steps.length !== durationDays) {
    return {
      valid: false,
      error: `Expected ${durationDays} strategy steps, got ${steps.length}.`,
    }
  }

  const days = steps.map((s) => s.day).sort((a, b) => a - b)
  for (let i = 0; i < durationDays; i++) {
    if (days[i] !== i + 1) {
      return {
        valid: false,
        error: `Strategy steps must be numbered 1 through ${durationDays}.`,
      }
    }
  }

  const allowedTypes = getAllowedContentTypes(contentMode)
  for (const step of steps) {
    if (!allowedTypes.includes(step.content_type as StrategyActiveContentType)) {
      return {
        valid: false,
        error: `Invalid content type "${step.content_type}" for ${STRATEGY_CONTENT_MODE_LABELS[contentMode]} mode.`,
      }
    }
  }

  const normalized = steps
    .slice()
    .sort((a, b) => a.day - b.day)
    .map((step) => ({ ...step, completed: false }))

  return { valid: true, steps: normalized }
}

export const strategyStepEditSchema = z.object({
  content_type: z.enum(STRATEGY_ACTIVE_CONTENT_TYPES),
  topic: z.string().min(1, "Topic is required").max(500),
  objective: z.string().min(1, "Objective is required").max(500),
  product_reference: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})

export type StrategyStepEditValues = z.infer<typeof strategyStepEditSchema>

export function parseStrategyContentMode(
  value: string | null | undefined,
): StrategyContentMode {
  if (value === "text_only" || value === "text_and_image") {
    return value
  }

  return "text_and_image"
}

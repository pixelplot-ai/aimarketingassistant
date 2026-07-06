import type { BrandProfileRow } from "@/types/app"
import type {
  StrategyContentMode,
  StrategyContentType,
} from "@/lib/validations/marketing-campaign"
import {
  getAllowedContentTypes,
  STRATEGY_CONTENT_MODE_LABELS,
} from "@/lib/validations/marketing-campaign"

export type BuildStrategyPromptInput = {
  name: string
  durationDays: number
  campaignGoal: string
  targetAudience?: string | null
  seasonality?: string | null
  extraInstructions?: string | null
  productNames: string[]
  brandProfile: BrandProfileRow | null
  contentMode: StrategyContentMode
}

function buildBrandSummary(brandProfile: BrandProfileRow): string {
  return [
    `Brand: ${brandProfile.brand_name}`,
    `Industry: ${brandProfile.industry}`,
    `Target audience: ${brandProfile.target_audience}`,
    `Brand voice: ${brandProfile.brand_voice.join(", ")}`,
    `Business: ${brandProfile.business_description}`,
  ].join("\n")
}

export function buildStrategyPrompt(input: BuildStrategyPromptInput): {
  system: string
  user: string
  summary: string
} {
  const allowedTypes = getAllowedContentTypes(input.contentMode)
  const contentTypes = allowedTypes.join(", ")
  const modeLabel = STRATEGY_CONTENT_MODE_LABELS[input.contentMode]

  const system = [
    "You are an expert social media marketing strategist.",
    "Create a day-by-day content strategy as valid JSON only — no markdown, no code fences, no extra text.",
    `Campaign content mode: ${modeLabel}.`,
    `Each step must use content_type from this list: ${contentTypes}.`,
    input.contentMode === "text_only"
      ? "Every step must use content_type text_post."
      : "Mix text_post and image_post across the campaign — include image posts on roughly half the days.",
    "Set completed to false for every step.",
    "When products are provided, assign product_reference (exact product name) to relevant steps only.",
  ].join(" ")

  const userSections = [
    "## Campaign",
    `Name: ${input.name}`,
    `Duration: ${input.durationDays} days`,
    `Content mode: ${modeLabel}`,
    `Goal: ${input.campaignGoal}`,
    input.targetAudience ? `Target audience: ${input.targetAudience}` : null,
    input.seasonality ? `Seasonality: ${input.seasonality}` : null,
    input.extraInstructions
      ? `Extra instructions: ${input.extraInstructions}`
      : null,
    "",
    input.productNames.length > 0
      ? ["## Products & Services (use exact names for product_reference)", ...input.productNames.map((n) => `- ${n}`), ""].join("\n")
      : "## Products & Services\nNone specified\n",
    input.brandProfile
      ? ["## Brand Profile", buildBrandSummary(input.brandProfile), ""].join("\n")
      : "",
    "## Output format",
    `Return a JSON object with a "steps" array containing exactly ${input.durationDays} objects.`,
    "Each object must have:",
    '- day: number (1 through ' + input.durationDays + ")",
    `- content_type: one of [${contentTypes}]`,
    "- topic: string (specific post topic)",
    "- objective: string (what this post should achieve)",
    "- product_reference: string or omit (exact name from products list)",
    "- notes: string or omit (creative direction hints)",
    "- completed: false",
  ]
    .filter((section) => section !== null && section !== "")
    .join("\n")

  return {
    system,
    user: userSections,
    summary: `marketing strategy for ${input.name} (${input.durationDays} days, ${modeLabel})`,
  }
}

export function formatStrategyContentType(contentType: string): string {
  return contentType.replace(/_/g, " ")
}

export type { StrategyContentType }

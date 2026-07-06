import type { BrandProfileRow } from "@/types/app"

import { resolveDefaultImagePrompt, resolveDefaultTextPrompt, resolveDefaultTextLengthPrompt } from "./default-prompts"
import type { AiTextOperation, BuildPromptInput } from "./types"
import { formatStrategyContentType } from "./strategy-prompt-builder"

export type { ProductContext } from "./types"

const OPERATION_INSTRUCTIONS: Record<AiTextOperation, string> = {
  generate_caption:
    "Write an engaging social media caption for this post. Return only the caption text without quotes or labels.",
  rewrite:
    "Rewrite the post content to improve clarity and engagement while preserving the core message. Return only the rewritten text.",
  improve_writing:
    "Improve the writing quality, grammar, and flow of this post. Return only the improved text.",
  generate_cta:
    "Generate a compelling call-to-action that fits this post and brand. Return only the CTA text.",
  generate_hashtags:
    "Generate relevant hashtags for this post. Return a single line of space-separated hashtags including the # symbol.",
  translate:
    "Translate the post content to the requested target language. Return only the translated text.",
  change_tone:
    "Rewrite the post content in the requested tone. Return only the rewritten text.",
  summarize:
    "Summarize the post content concisely for social media. Return only the summary.",
  expand:
    "Expand the post content with more detail while staying on-brand. Return only the expanded text.",
  shorten:
    "Shorten the post content while keeping the key message. Return only the shortened text.",
}

function buildBrandContext(brandProfile: BrandProfileRow): string {
  return [
    `Brand Name: ${brandProfile.brand_name}`,
    `Industry: ${brandProfile.industry}`,
    `Business Description: ${brandProfile.business_description}`,
    `Target Audience: ${brandProfile.target_audience}`,
    `Brand Voice: ${brandProfile.brand_voice.join(", ")}`,
    `Writing Style: ${brandProfile.writing_style.join(", ")}`,
    `Brand Values: ${brandProfile.brand_values.join(", ")}`,
    `Preferred CTAs: ${brandProfile.preferred_ctas.join(", ")}`,
    `Keywords: ${brandProfile.keywords.length > 0 ? brandProfile.keywords.join(", ") : "None"}`,
    `Avoid Words: ${brandProfile.avoid_words.length > 0 ? brandProfile.avoid_words.join(", ") : "None"}`,
    `Competitors: ${brandProfile.competitors.length > 0 ? brandProfile.competitors.join(", ") : "None"}`,
    `Brand Colors: primary ${brandProfile.color_primary}, secondary ${brandProfile.color_secondary}, accent ${brandProfile.color_accent}`,
  ].join("\n")
}

export function buildPrompt(input: BuildPromptInput): {
  system: string
  user: string
  summary: string
} {
  const platforms =
    input.platformNames.length > 0
      ? input.platformNames.join(", ")
      : "General social media"

  const operationInstruction = OPERATION_INSTRUCTIONS[input.operation]
  const extraInstructions: string[] = []

  if (input.operation === "translate" && input.targetLanguage) {
    extraInstructions.push(`Target language: ${input.targetLanguage}`)
  }

  if (input.operation === "change_tone" && input.tone) {
    extraInstructions.push(`Target tone: ${input.tone}`)
  }

  if (input.userInstruction?.trim()) {
    extraInstructions.push(`Additional instruction: ${input.userInstruction.trim()}`)
  }

  extraInstructions.push(
    `Length guidance: ${resolveDefaultTextLengthPrompt(input.defaultTextLengthPrompt)}`,
  )

  const hasBrand = input.brandProfile !== null
  const brandProfile = input.brandProfile

  const systemParts = [resolveDefaultTextPrompt(input.defaultTextPrompt)]

  if (hasBrand) {
    systemParts.push(
      "Always follow the brand profile. Never use words listed under Avoid Words.",
    )
  } else {
    systemParts.push(
      "No brand profile was provided — write clear, engaging content suited to the target platform.",
    )
  }

  const system = systemParts.join(" ")

  const userSections = [
    ...(hasBrand && brandProfile
      ? ["## Brand Profile", buildBrandContext(brandProfile), ""]
      : []),
    ...(input.productContext
      ? [
          "## Featured Product / Service",
          [
            `Name: ${input.productContext.name}`,
            input.productContext.description
              ? `Description: ${input.productContext.description}`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
          "",
        ]
      : []),
    ...(input.strategyStep
      ? [
          "## Marketing Strategy Step",
          [
            `Day: ${input.strategyStep.day} of ${input.strategyStep.totalDays}`,
            `Content type: ${formatStrategyContentType(input.strategyStep.content_type)}`,
            `Topic: ${input.strategyStep.topic}`,
            `Objective: ${input.strategyStep.objective}`,
            input.strategyStep.notes
              ? `Notes: ${input.strategyStep.notes}`
              : null,
            input.strategyStep.product_reference
              ? `Featured product: ${input.strategyStep.product_reference}`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
          "Follow this strategy step as the primary creative direction for the caption.",
          "",
        ]
      : []),
    "## Target Platforms",
    platforms,
    "",
    "## Current Post Content",
    input.postContent.trim() ||
      (hasBrand
        ? "(empty — create new content based on the brand and instructions)"
        : "(empty — create new content based on the task and instructions)"),
    "",
    "## Task",
    operationInstruction,
    ...extraInstructions,
  ]

  const user = userSections.join("\n")

  const summary = `${input.operation} for ${platforms}`

  return { system, user, summary }
}

export function buildImagePrompt(input: {
  prompt: string
  postContent: string
  brandProfile: BrandProfileRow | null
  settingsStyle: string
  defaultImagePrompt?: string | null
  productContext?: { name: string; description?: string | null } | null
  hasProductImage?: boolean
}): string {
  const { brandProfile, prompt, settingsStyle, postContent } = input
  const basePrompt = resolveDefaultImagePrompt(input.defaultImagePrompt)
  const caption = postContent.trim()
  const extraDirection = prompt.trim()

  const sections = [basePrompt, `Visual style: ${settingsStyle}`]

  if (brandProfile) {
    sections.push(
      `Brand: ${brandProfile.brand_name}`,
      `Industry: ${brandProfile.industry}`,
      `Use brand colors as guidance — primary ${brandProfile.color_primary}, secondary ${brandProfile.color_secondary}, accent ${brandProfile.color_accent}.`,
    )
  } else {
    sections.push(
      "No brand profile configured — create a polished, professional social media image suited to the caption.",
    )
  }

  if (input.productContext) {
    sections.push(
      "## Featured Product / Service",
      [
        `Name: ${input.productContext.name}`,
        input.productContext.description
          ? `Description: ${input.productContext.description}`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )

    if (input.hasProductImage) {
      sections.push(
        "## Product / service reference image (critical)",
        [
          "A reference image of this product or service is attached.",
          "Do NOT alter, redraw, restyle, or replace the product/service itself — preserve its exact appearance, colors, shape, packaging, and proportions.",
          "Do NOT apply filters, artistic effects, or brand color overlays to the product/service.",
          "Place the reference product/service prominently and unchanged; build the background, scene, layout, and supporting elements around it.",
          "Match the surrounding composition to the brand visual style without modifying the product/service image.",
        ].join("\n"),
      )
    }
  }

  sections.push(
    "## Post caption / content",
    caption || "(No post content yet — create a visual that fits the brand and any extra direction below.)",
  )

  if (extraDirection) {
    sections.push("## Additional image direction", extraDirection)
  }

  sections.push(
    "Illustrate the post content above. The image should feel like a natural visual companion to the caption.",
  )

  return sections.join("\n")
}

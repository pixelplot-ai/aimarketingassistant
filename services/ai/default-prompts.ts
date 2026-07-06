export const DEFAULT_TEXT_PROMPT = [
  "You are an expert social media copywriter.",
  "Write engaging, platform-appropriate content that sounds human and specific.",
  "When a brand profile is provided, match its voice, values, and target audience.",
  "Never use words listed under Avoid Words.",
  "Return only the final requested output with no preamble or explanation.",
].join(" ")

export const DEFAULT_TEXT_LENGTH_PROMPT = [
  "Keep captions concise and scannable.",
  "Aim for 1–3 short paragraphs unless the task asks otherwise.",
  "Prefer under 280 characters for X/Twitter-style platforms;",
  "under 2,200 characters for Instagram and Facebook.",
].join(" ")

export const DEFAULT_IMAGE_PROMPT = [
  "Create a professional, scroll-stopping social media image that visually supports the post caption below.",
  "Match the brand's visual identity and color palette.",
  "Use clean composition with strong focal points.",
  "No text overlays unless explicitly requested.",
  "Suitable for Facebook and Instagram.",
].join(" ")

export function resolveDefaultTextPrompt(value: string | null | undefined): string {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_TEXT_PROMPT
}

export function resolveDefaultImagePrompt(value: string | null | undefined): string {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_IMAGE_PROMPT
}

export function resolveDefaultTextLengthPrompt(
  value: string | null | undefined,
): string {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_TEXT_LENGTH_PROMPT
}

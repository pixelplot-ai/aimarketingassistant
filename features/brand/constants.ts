export const BRAND_VOICE_OPTIONS = [
  "Professional",
  "Friendly",
  "Luxury",
  "Funny",
  "Educational",
  "Technical",
  "Minimal",
  "Inspirational",
  "Conversational",
] as const

export const WRITING_STYLE_OPTIONS = [
  "Storytelling",
  "Short-form",
  "Long-form",
  "Marketing",
  "Educational",
  "Persuasive",
  "Informative",
] as const

export const BRAND_VALUES_OPTIONS = [
  "Trust",
  "Innovation",
  "Simplicity",
  "Transparency",
  "Sustainability",
  "Community",
] as const

export const CTA_OPTIONS = [
  "Contact Us",
  "Learn More",
  "Book Now",
  "Buy Today",
  "Visit Website",
] as const

export type BrandVoiceOption = (typeof BRAND_VOICE_OPTIONS)[number]
export type WritingStyleOption = (typeof WRITING_STYLE_OPTIONS)[number]
export type BrandValueOption = (typeof BRAND_VALUES_OPTIONS)[number]
export type CtaOption = (typeof CTA_OPTIONS)[number]

export const BRAND_ASSET_TYPES = [
  { value: "guidelines", label: "Brand Guidelines PDF" },
  { value: "font", label: "Font" },
  { value: "image", label: "Image" },
] as const

export const LOGO_MAX_BYTES = 10 * 1024 * 1024
export const BRAND_ASSET_MAX_BYTES = 10 * 1024 * 1024

export const LOGO_ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const

export const BRAND_ASSET_ACCEPTED_TYPES = [
  ...LOGO_ACCEPTED_TYPES,
  "application/pdf",
  "font/ttf",
  "font/otf",
  "font/woff",
  "font/woff2",
] as const

import type { BrandProfileRow, SettingsBundle } from "@/types/app"

export type AiTextOperation =
  | "generate_caption"
  | "rewrite"
  | "improve_writing"
  | "generate_cta"
  | "generate_hashtags"
  | "translate"
  | "change_tone"
  | "summarize"
  | "expand"
  | "shorten"

export type ImageAspectRatio = "square" | "portrait" | "landscape"

export type ProductContext = {
  name: string
  description?: string | null
}

export type StrategyStepPromptContext = {
  day: number
  totalDays: number
  content_type: string
  topic: string
  objective: string
  notes?: string
  product_reference?: string
}

export type BuildPromptInput = {
  brandProfile: BrandProfileRow | null
  postContent: string
  platformIds: string[]
  platformNames: string[]
  userInstruction?: string
  operation: AiTextOperation
  targetLanguage?: string
  tone?: string
  defaultTextPrompt?: string | null
  defaultTextLengthPrompt?: string | null
  productContext?: ProductContext | null
  strategyStep?: StrategyStepPromptContext | null
}

export type TextCompletionContext = {
  brandProfile: BrandProfileRow | null
  postContent: string
  platformIds: string[]
  platformNames: string[]
  settings: SettingsBundle
  userInstruction?: string
  targetLanguage?: string
  tone?: string
  productContext?: ProductContext | null
  strategyStep?: StrategyStepPromptContext | null
}

export type TextCompletionResult = {
  text: string
  tokensUsed: number | null
  promptSummary: string
}

/** @deprecated Use TextCompletionResult */
export type OpenAiCompletionResult = TextCompletionResult

export type GenerateImageInput = {
  prompt: string
  postContent: string
  aspectRatio: ImageAspectRatio
  brandProfile: BrandProfileRow | null
  settings: SettingsBundle
  userId: string
  productContext?: ProductContext | null
  productImageBytes?: { data: Buffer; mimeType: string } | null
}

export type GenerateImageResult = {
  storagePath: string
  mimeType: string
  width: number
  height: number
  fileSize: number
}

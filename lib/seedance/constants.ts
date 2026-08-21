export const SEEDANCE_REFS_BUCKET = "seedance-refs"

export const CLIP_DURATION_MIN = 1
export const CLIP_DURATION_MAX = 30
export const CLIP_DURATION_DEFAULT = 5

export const CLIP_QUALITIES = ["standard", "pro"] as const
export const SEEDANCE_RATIOS = [
  "16:9",
  "9:16",
  "1:1",
  "4:3",
  "3:4",
  "21:9",
] as const

export const SEEDANCE_MODELS = [
  { id: "seedance_2_5", label: "Seedance 2.5" },
  { id: "seedance_2_0", label: "Seedance 2.0" },
  { id: "seedance_2_0_fast", label: "Seedance 2.0 Fast" },
] as const

export type SeedanceModelOption = (typeof SEEDANCE_MODELS)[number]["id"]
export type ClipDuration = number
export type ClipQuality = (typeof CLIP_QUALITIES)[number]
export type SeedanceRatio = (typeof SEEDANCE_RATIOS)[number]

export const MAX_REFERENCE_IMAGES = 9
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp"
export const AUDIO_ACCEPT = "audio/wav,audio/mpeg,audio/mp3"

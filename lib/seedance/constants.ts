export const SEEDANCE_REFS_BUCKET = "seedance-refs"

export const CLIP_DURATIONS = [5, 10] as const
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
  { id: "seedance_2_0", label: "Seedance 2.0" },
  { id: "seedance_2_0_fast", label: "Seedance 2.0 Fast" },
] as const

export type SeedanceModelOption = (typeof SEEDANCE_MODELS)[number]["id"]
export type ClipDuration = (typeof CLIP_DURATIONS)[number]
export type ClipQuality = (typeof CLIP_QUALITIES)[number]
export type SeedanceRatio = (typeof SEEDANCE_RATIOS)[number]

export const MAX_REFERENCE_IMAGES = 9
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp"
export const AUDIO_ACCEPT = "audio/wav,audio/mpeg,audio/mp3"

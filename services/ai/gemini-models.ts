/** Models retired by Google that should be mapped before API calls. */
const DEPRECATED_GEMINI_TEXT_MODEL_ALIASES: Record<string, string> = {
  "gemini-2.0-flash-preview-image-generation": "gemini-2.5-flash",
  "gemini-2.0-flash": "gemini-2.5-flash",
  "gemini-2.0-flash-lite": "gemini-2.5-flash",
  "gemini-1.5-flash": "gemini-2.5-flash",
  "gemini-1.5-pro": "gemini-2.5-pro",
}

export const GEMINI_IMAGE_GENERATION_MODEL = "gemini-2.5-flash-image"

export const DEFAULT_GEMINI_TEXT_MODEL = "gemini-2.5-flash"

export function resolveGeminiTextModel(model: string): string {
  return DEPRECATED_GEMINI_TEXT_MODEL_ALIASES[model] ?? model
}

export function formatGeminiApiError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  if (message.includes("no longer available") || message.includes("[404")) {
    return "The selected Gemini model is no longer available. Update it in Settings → AI."
  }

  if (message.includes("API key not valid") || message.includes("[401")) {
    return "Gemini API key is invalid. Check GEMINI_API_KEY in your environment."
  }

  if (message.includes("[429")) {
    return "Gemini rate limit reached. Please wait a moment and try again."
  }

  if (message.includes("[403")) {
    return "Gemini API access denied. Verify your API key and billing setup."
  }

  return "AI text generation failed. Please try again."
}

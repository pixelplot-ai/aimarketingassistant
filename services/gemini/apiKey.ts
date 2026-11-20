/** Server-only Gemini API key. Same aliases as pixelplot-reloaded. */
export function getGeminiApiKey(): string {
  const key =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY
  if (!key?.trim()) {
    throw new Error(
      "Gemini API key not configured (GEMINI_API_KEY or GOOGLE_AI_API_KEY)",
    )
  }
  return key.trim()
}

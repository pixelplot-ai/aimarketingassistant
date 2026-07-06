import { GoogleGenerativeAI } from "@google/generative-ai"

import { AppError } from "@/lib/errors/app-error"

export function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new AppError({
      code: "EXTERNAL_SERVICE",
      message: "GEMINI_API_KEY is not configured",
      userMessage: "Gemini is not configured. Add GEMINI_API_KEY to your environment.",
    })
  }

  return new GoogleGenerativeAI(apiKey)
}

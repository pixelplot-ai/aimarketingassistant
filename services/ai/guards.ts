export { assertBrandProfileComplete } from "@/features/brand/guards"

import { createClient } from "@/services/supabase/server"
import type { Enums, Json } from "@/types/database"

export type LogAiGenerationInput = {
  operation: string
  provider: Enums<"ai_provider">
  brandProfileId?: string | null
  postId?: string | null
  promptSummary: string
  tokensUsed?: number | null
  metadata?: Record<string, unknown>
}

export async function logAiGeneration(
  input: LogAiGenerationInput,
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase.from("ai_generations").insert({
    operation: input.operation,
    provider: input.provider,
    brand_profile_id: input.brandProfileId ?? null,
    post_id: input.postId ?? null,
    prompt_summary: input.promptSummary,
    tokens_used: input.tokensUsed ?? null,
    metadata: (input.metadata ?? {}) as Json,
  })

  if (error) {
    console.error("[ai_generations] Failed to log generation:", error.message)
  }
}

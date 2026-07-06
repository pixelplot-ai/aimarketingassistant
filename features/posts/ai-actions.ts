"use server"

import { revalidatePath } from "next/cache"

import { AppError } from "@/lib/errors/app-error"
import { getWorkspaceUserId } from "@/lib/auth/workspace"
import { logAiGeneration } from "@/services/ai/guards"
import {
  changeTone,
  expand,
  generateCaption,
  generateCta,
  generateHashtags,
  improveWriting,
  rewrite,
  shorten,
  summarize,
  translate,
  resolveTextProvider,
} from "@/services/ai/text"
import type { AiTextOperation } from "@/services/ai/types"
import type { StrategyStepPromptContext } from "@/services/ai/types"
import { createClient } from "@/services/supabase/server"
import type { ActionResult, BrandProfileRow, SettingsBundle } from "@/types/app"

export type ProductContext = {
  name: string
  description?: string | null
}

export type AiTextActionInput = {
  postContent: string
  platformIds: string[]
  userInstruction?: string
  postId?: string | null
  targetLanguage?: string
  tone?: string
  productContext?: ProductContext | null
  strategyStep?: StrategyStepPromptContext | null
}

type AiTextActionResult = { text: string }

async function getAuthenticatedUserId(): Promise<string> {
  return getWorkspaceUserId()
}

async function loadBrandProfile(
  userId: string,
): Promise<BrandProfileRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("brand_profiles")
    .select("*")
    .eq("user_id", userId)
    .eq("is_default", true)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw new AppError({
      code: "INTERNAL",
      message: error.message,
      userMessage: "Failed to load brand profile.",
    })
  }

  return data
}

async function loadSettings(userId: string): Promise<SettingsBundle> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  if (error || !data) {
    throw new AppError({
      code: "INTERNAL",
      message: error?.message ?? "Settings not found",
      userMessage: "Failed to load AI settings.",
    })
  }

  return data
}

async function loadPlatformNames(platformIds: string[]): Promise<string[]> {
  if (platformIds.length === 0) {
    return []
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("platforms")
    .select("id, display_name")
    .in("id", platformIds)

  if (error) {
    throw new AppError({
      code: "INTERNAL",
      message: error.message,
      userMessage: "Failed to load platforms.",
    })
  }

  const nameById = new Map((data ?? []).map((row) => [row.id, row.display_name]))
  return platformIds.map((id) => nameById.get(id) ?? id)
}

function toActionError(error: unknown): ActionResult<never> {
  if (AppError.isAppError(error)) {
    return { success: false, error: error.userMessage }
  }

  if (error instanceof Error) {
    return { success: false, error: error.message }
  }

  return { success: false, error: "Something went wrong. Please try again." }
}

async function runAiTextAction(
  operation: AiTextOperation,
  input: AiTextActionInput,
  runner: (context: {
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
  }) => Promise<{ text: string; tokensUsed: number | null; promptSummary: string }>,
): Promise<ActionResult<AiTextActionResult>> {
  try {
    const userId = await getAuthenticatedUserId()
    const [brandProfile, settings, platformNames] = await Promise.all([
      loadBrandProfile(userId),
      loadSettings(userId),
      loadPlatformNames(input.platformIds),
    ])

    const result = await runner({
      brandProfile,
      postContent: input.postContent,
      platformIds: input.platformIds,
      platformNames,
      settings,
      userInstruction: input.userInstruction,
      targetLanguage: input.targetLanguage,
      tone: input.tone,
      productContext: input.productContext,
      strategyStep: input.strategyStep,
    })

    await logAiGeneration({
      operation,
      provider: resolveTextProvider(settings),
      brandProfileId: brandProfile?.id ?? null,
      postId: input.postId,
      promptSummary: result.promptSummary,
      tokensUsed: result.tokensUsed,
      metadata: {
        platform_ids: input.platformIds,
        has_user_instruction: Boolean(input.userInstruction?.trim()),
        has_brand_profile: Boolean(brandProfile),
      },
    })

    return { success: true, data: { text: result.text } }
  } catch (error) {
    return toActionError(error)
  }
}

export async function aiGenerateCaption(
  input: AiTextActionInput,
): Promise<ActionResult<AiTextActionResult>> {
  return runAiTextAction("generate_caption", input, generateCaption)
}

export async function aiRewrite(
  input: AiTextActionInput,
): Promise<ActionResult<AiTextActionResult>> {
  return runAiTextAction("rewrite", input, rewrite)
}

export async function aiImproveWriting(
  input: AiTextActionInput,
): Promise<ActionResult<AiTextActionResult>> {
  return runAiTextAction("improve_writing", input, improveWriting)
}

export async function aiGenerateCta(
  input: AiTextActionInput,
): Promise<ActionResult<AiTextActionResult>> {
  return runAiTextAction("generate_cta", input, generateCta)
}

export async function aiGenerateHashtags(
  input: AiTextActionInput,
): Promise<ActionResult<AiTextActionResult>> {
  return runAiTextAction("generate_hashtags", input, generateHashtags)
}

export async function aiTranslate(
  input: AiTextActionInput & { targetLanguage: string },
): Promise<ActionResult<AiTextActionResult>> {
  return runAiTextAction("translate", input, (context) =>
    translate({ ...context, targetLanguage: input.targetLanguage }),
  )
}

export async function aiChangeTone(
  input: AiTextActionInput & { tone: string },
): Promise<ActionResult<AiTextActionResult>> {
  return runAiTextAction("change_tone", input, (context) =>
    changeTone({ ...context, tone: input.tone }),
  )
}

export async function aiSummarize(
  input: AiTextActionInput,
): Promise<ActionResult<AiTextActionResult>> {
  return runAiTextAction("summarize", input, summarize)
}

export async function aiExpand(
  input: AiTextActionInput,
): Promise<ActionResult<AiTextActionResult>> {
  return runAiTextAction("expand", input, expand)
}

export async function aiShorten(
  input: AiTextActionInput,
): Promise<ActionResult<AiTextActionResult>> {
  return runAiTextAction("shorten", input, shorten)
}

export async function aiCustomInstruction(
  input: AiTextActionInput,
): Promise<ActionResult<AiTextActionResult>> {
  return runAiTextAction("rewrite", input, rewrite)
}

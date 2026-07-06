"use server"

import { revalidatePath } from "next/cache"

import { AppError } from "@/lib/errors/app-error"
import { getWorkspaceUserId } from "@/lib/auth/workspace"
import {
  campaignFormSchema,
  getAllowedContentTypes,
  parseStrategyContentMode,
  parseStrategySteps,
  strategyStepEditSchema,
  type CampaignFormValues,
  type StrategyContentMode,
  type StrategyStep,
  type StrategyStepEditValues,
} from "@/lib/validations/marketing-campaign"
import { generateMarketingStrategy } from "@/services/ai/strategy-generation"
import { createClient } from "@/services/supabase/server"
import type {
  ActionResult,
  ActiveCampaignContext,
  BrandProfileRow,
  MarketingCampaignRow,
  MarketingCampaignWithProgress,
  SettingsBundle,
} from "@/types/app"
import type { Json } from "@/types/database"

const MARKETING_PATH = "/marketing-strategy"

async function getAuthUserId(): Promise<string> {
  return getWorkspaceUserId()
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

async function loadBrandProfile(
  userId: string,
): Promise<BrandProfileRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("brand_profiles")
    .select("*")
    .eq("user_id", userId)
    .eq("is_default", true)
    .is("deleted_at", null)
    .maybeSingle()

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

async function resolveProductNames(
  userId: string,
  productIds: string[],
): Promise<string[]> {
  if (productIds.length === 0) {
    return []
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from("products")
    .select("id, name")
    .eq("user_id", userId)
    .in("id", productIds)

  const nameById = new Map((data ?? []).map((p) => [p.id, p.name]))
  return productIds
    .map((id) => nameById.get(id))
    .filter((name): name is string => Boolean(name))
}

function enrichCampaign(
  row: MarketingCampaignRow,
  productNames: string[],
): MarketingCampaignWithProgress {
  const steps = parseStrategySteps(row.strategy)
  const completedCount = steps.filter((s) => s.completed).length

  return {
    ...row,
    productNames,
    completedCount,
    totalSteps: steps.length > 0 ? steps.length : row.duration_days,
  }
}

function getCurrentStep(steps: StrategyStep[]): StrategyStep | null {
  const sorted = steps.slice().sort((a, b) => a.day - b.day)
  return sorted.find((s) => !s.completed) ?? null
}

async function getOwnedCampaign(
  userId: string,
  id: string,
): Promise<MarketingCampaignRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("marketing_campaigns")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw new AppError({
      code: "INTERNAL",
      message: error.message,
      userMessage: "Failed to load campaign.",
    })
  }

  return data
}

export async function getCampaigns(): Promise<
  ActionResult<MarketingCampaignWithProgress[]>
> {
  try {
    const userId = await getAuthUserId()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("marketing_campaigns")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })

    if (error) {
      throw new AppError({
        code: "INTERNAL",
        message: error.message,
        userMessage: "Failed to load campaigns.",
      })
    }

    const campaigns = await Promise.all(
      (data ?? []).map(async (row) => {
        const productNames = await resolveProductNames(userId, row.product_ids)
        return enrichCampaign(row, productNames)
      }),
    )

    return { success: true, data: campaigns }
  } catch (error) {
    return toActionError(error)
  }
}

export async function getCampaign(
  id: string,
): Promise<ActionResult<MarketingCampaignWithProgress>> {
  try {
    const userId = await getAuthUserId()
    const row = await getOwnedCampaign(userId, id)

    if (!row) {
      return { success: false, error: "Campaign not found." }
    }

    const productNames = await resolveProductNames(userId, row.product_ids)
    return { success: true, data: enrichCampaign(row, productNames) }
  } catch (error) {
    return toActionError(error)
  }
}

export async function getActiveCampaign(): Promise<
  ActionResult<ActiveCampaignContext | null>
> {
  try {
    const userId = await getAuthUserId()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("marketing_campaigns")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle()

    if (error) {
      throw new AppError({
        code: "INTERNAL",
        message: error.message,
        userMessage: "Failed to load active campaign.",
      })
    }

    if (!data) {
      return { success: true, data: null }
    }

    const productNames = await resolveProductNames(userId, data.product_ids)
    const enriched = enrichCampaign(data, productNames)
    const steps = parseStrategySteps(data.strategy)

    return {
      success: true,
      data: {
        ...enriched,
        currentStep: getCurrentStep(steps),
      },
    }
  } catch (error) {
    return toActionError(error)
  }
}

export async function createCampaign(
  values: CampaignFormValues,
): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await getAuthUserId()
    const parsed = campaignFormSchema.safeParse(values)

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Validation error",
      }
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("marketing_campaigns")
      .insert({
        user_id: userId,
        name: parsed.data.name,
        duration_days: parsed.data.duration_days,
        campaign_goal: parsed.data.campaign_goal,
        target_audience: parsed.data.target_audience?.trim() || null,
        seasonality: parsed.data.seasonality?.trim() || null,
        extra_instructions: parsed.data.extra_instructions?.trim() || null,
        product_ids: parsed.data.product_ids,
        strategy: [] as Json,
      })
      .select("id")
      .single()

    if (error || !data) {
      throw new AppError({
        code: "INTERNAL",
        message: error?.message ?? "Insert failed",
        userMessage: "Failed to create campaign.",
      })
    }

    revalidatePath(MARKETING_PATH)
    return { success: true, data: { id: data.id } }
  } catch (error) {
    return toActionError(error)
  }
}

export async function updateCampaign(
  id: string,
  values: CampaignFormValues,
): Promise<ActionResult<void>> {
  try {
    const userId = await getAuthUserId()
    const parsed = campaignFormSchema.safeParse(values)

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Validation error",
      }
    }

    const existing = await getOwnedCampaign(userId, id)
    if (!existing) {
      return { success: false, error: "Campaign not found." }
    }

    const existingSteps = parseStrategySteps(existing.strategy)
    if (
      existingSteps.length > 0 &&
      parsed.data.duration_days !== existing.duration_days
    ) {
      return {
        success: false,
        error:
          "Cannot change duration after a strategy has been generated. Delete and recreate the campaign instead.",
      }
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from("marketing_campaigns")
      .update({
        name: parsed.data.name,
        duration_days: parsed.data.duration_days,
        campaign_goal: parsed.data.campaign_goal,
        target_audience: parsed.data.target_audience?.trim() || null,
        seasonality: parsed.data.seasonality?.trim() || null,
        extra_instructions: parsed.data.extra_instructions?.trim() || null,
        product_ids: parsed.data.product_ids,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)

    if (error) {
      throw new AppError({
        code: "INTERNAL",
        message: error.message,
        userMessage: "Failed to update campaign.",
      })
    }

    revalidatePath(MARKETING_PATH)
    revalidatePath(`${MARKETING_PATH}/${id}`)
    return { success: true, data: undefined }
  } catch (error) {
    return toActionError(error)
  }
}

export async function deleteCampaign(id: string): Promise<ActionResult<void>> {
  try {
    const userId = await getAuthUserId()
    const supabase = await createClient()
    const { error } = await supabase
      .from("marketing_campaigns")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)

    if (error) {
      throw new AppError({
        code: "INTERNAL",
        message: error.message,
        userMessage: "Failed to delete campaign.",
      })
    }

    revalidatePath(MARKETING_PATH)
    return { success: true, data: undefined }
  } catch (error) {
    return toActionError(error)
  }
}

export async function setActiveCampaign(
  id: string,
): Promise<ActionResult<void>> {
  try {
    const userId = await getAuthUserId()
    const existing = await getOwnedCampaign(userId, id)

    if (!existing) {
      return { success: false, error: "Campaign not found." }
    }

    const supabase = await createClient()

    const { error: deactivateError } = await supabase
      .from("marketing_campaigns")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("is_active", true)

    if (deactivateError) {
      throw new AppError({
        code: "INTERNAL",
        message: deactivateError.message,
        userMessage: "Failed to update active campaign.",
      })
    }

    const { error } = await supabase
      .from("marketing_campaigns")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)

    if (error) {
      throw new AppError({
        code: "INTERNAL",
        message: error.message,
        userMessage: "Failed to set active campaign.",
      })
    }

    revalidatePath(MARKETING_PATH)
    revalidatePath(`${MARKETING_PATH}/${id}`)
    revalidatePath("/posts")
    return { success: true, data: undefined }
  } catch (error) {
    return toActionError(error)
  }
}

export async function generateCampaignStrategy(
  id: string,
  contentMode: StrategyContentMode,
): Promise<ActionResult<{ steps: StrategyStep[] }>> {
  try {
    const userId = await getAuthUserId()
    const campaign = await getOwnedCampaign(userId, id)

    if (!campaign) {
      return { success: false, error: "Campaign not found." }
    }

    const [brandProfile, settings, productNames] = await Promise.all([
      loadBrandProfile(userId),
      loadSettings(userId),
      resolveProductNames(userId, campaign.product_ids),
    ])

    const result = await generateMarketingStrategy({
      name: campaign.name,
      durationDays: campaign.duration_days,
      campaignGoal: campaign.campaign_goal,
      targetAudience: campaign.target_audience,
      seasonality: campaign.seasonality,
      extraInstructions: campaign.extra_instructions,
      productNames,
      brandProfile,
      settings,
      campaignId: id,
      contentMode,
    })

    const supabase = await createClient()
    const { error } = await supabase
      .from("marketing_campaigns")
      .update({
        strategy: result.steps as unknown as Json,
        strategy_content_mode: contentMode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)

    if (error) {
      throw new AppError({
        code: "INTERNAL",
        message: error.message,
        userMessage: "Failed to save generated strategy.",
      })
    }

    revalidatePath(MARKETING_PATH)
    revalidatePath(`${MARKETING_PATH}/${id}`)
    revalidatePath("/posts")
    return { success: true, data: { steps: result.steps } }
  } catch (error) {
    return toActionError(error)
  }
}

async function persistStrategySteps(
  userId: string,
  campaignId: string,
  steps: StrategyStep[],
): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("marketing_campaigns")
    .update({
      strategy: steps as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
    .eq("user_id", userId)

  if (error) {
    throw new AppError({
      code: "INTERNAL",
      message: error.message,
      userMessage: "Failed to update strategy progress.",
    })
  }

  revalidatePath(MARKETING_PATH)
  revalidatePath(`${MARKETING_PATH}/${campaignId}`)
  revalidatePath("/posts")
  return { success: true, data: undefined }
}

export async function markStrategyStepCompleted(
  campaignId: string,
  day: number,
): Promise<ActionResult<void>> {
  try {
    const userId = await getAuthUserId()
    const campaign = await getOwnedCampaign(userId, campaignId)

    if (!campaign) {
      return { success: false, error: "Campaign not found." }
    }

    const steps = parseStrategySteps(campaign.strategy)
    const index = steps.findIndex((s) => s.day === day)

    if (index === -1) {
      return { success: false, error: "Strategy step not found." }
    }

    const updated = steps.map((step) =>
      step.day === day ? { ...step, completed: true } : step,
    )

    return persistStrategySteps(userId, campaignId, updated)
  } catch (error) {
    return toActionError(error)
  }
}

export async function toggleStrategyStepCompleted(
  campaignId: string,
  day: number,
  completed: boolean,
): Promise<ActionResult<void>> {
  try {
    const userId = await getAuthUserId()
    const campaign = await getOwnedCampaign(userId, campaignId)

    if (!campaign) {
      return { success: false, error: "Campaign not found." }
    }

    const steps = parseStrategySteps(campaign.strategy)
    const index = steps.findIndex((s) => s.day === day)

    if (index === -1) {
      return { success: false, error: "Strategy step not found." }
    }

    const updated = steps.map((step) =>
      step.day === day ? { ...step, completed } : step,
    )

    return persistStrategySteps(userId, campaignId, updated)
  } catch (error) {
    return toActionError(error)
  }
}

export async function updateStrategyStep(
  campaignId: string,
  day: number,
  values: StrategyStepEditValues,
): Promise<ActionResult<void>> {
  try {
    const userId = await getAuthUserId()
    const campaign = await getOwnedCampaign(userId, campaignId)

    if (!campaign) {
      return { success: false, error: "Campaign not found." }
    }

    const parsed = strategyStepEditSchema.safeParse(values)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Validation error",
      }
    }

    const contentMode = parseStrategyContentMode(campaign.strategy_content_mode)
    const allowedTypes = getAllowedContentTypes(contentMode)

    if (
      !allowedTypes.includes(
        parsed.data.content_type as (typeof allowedTypes)[number],
      )
    ) {
      return {
        success: false,
        error: "Content type is not allowed for this campaign's content mode.",
      }
    }

    const steps = parseStrategySteps(campaign.strategy)
    const index = steps.findIndex((s) => s.day === day)

    if (index === -1) {
      return { success: false, error: "Strategy step not found." }
    }

    const updated = steps.map((step) =>
      step.day === day
        ? {
            ...step,
            content_type: parsed.data.content_type,
            topic: parsed.data.topic,
            objective: parsed.data.objective,
            product_reference: parsed.data.product_reference?.trim() || undefined,
            notes: parsed.data.notes?.trim() || undefined,
          }
        : step,
    )

    return persistStrategySteps(userId, campaignId, updated)
  } catch (error) {
    return toActionError(error)
  }
}

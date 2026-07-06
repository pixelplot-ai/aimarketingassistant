"use server"

import { revalidatePath } from "next/cache"

import { z } from "zod"

import {
  extractBrandInfoFromPageText,
  type BrandExtractResult,
} from "@/features/brand/lib/extraction"
import {
  computeBrandProfileComplete,
  getDefaultBrandProfile,
} from "@/features/brand/guards"
import { getBrandProfileDefaultValues } from "@/features/brand/lib/mappers"
import { getWorkspaceUserId } from "@/lib/auth/workspace"
import { AppError } from "@/lib/errors/app-error"
import {
  brandProfileFormSchema,
  extractBrandFromUrlSchema,
  type BrandProfileFormValues,
} from "@/lib/validations/brand-profile"
import { fetchPageHtml, prepareTextContent } from "@/lib/web-page-content"
import { createClient } from "@/services/supabase/server"
import type { ActionResult, BrandProfileRow, SettingsBundle } from "@/types/app"

const SETTINGS_PATH = "/settings"

async function loadSettings(userId: string): Promise<SettingsBundle | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  return data ?? null
}

export async function getBrandProfile(): Promise<
  ActionResult<BrandProfileRow | null>
> {
  try {
    const workspaceUserId = await getWorkspaceUserId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("brand_profiles")
      .select("*")
      .eq("user_id", workspaceUserId)
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

    return { success: true, data: data ?? null }
  } catch (error) {
    return {
      success: false,
      error: AppError.fromUnknown(error).userMessage,
    }
  }
}

export async function upsertBrandProfile(
  values: BrandProfileFormValues,
): Promise<ActionResult<BrandProfileRow>> {
  try {
    const parsed = brandProfileFormSchema.parse(values)
    const workspaceUserId = await getWorkspaceUserId()
    const supabase = await createClient()
    const isComplete = computeBrandProfileComplete(parsed)

    const formPayload = {
      brand_name: parsed.brand_name.trim(),
      business_description: parsed.business_description.trim(),
      industry: parsed.industry.trim(),
      target_audience: parsed.target_audience.trim(),
      brand_voice: parsed.brand_voice,
      writing_style: parsed.writing_style,
      brand_values: parsed.brand_values,
      preferred_ctas: parsed.preferred_ctas,
      keywords: parsed.keywords,
      avoid_words: parsed.avoid_words,
      competitors: parsed.competitors,
      color_primary: parsed.color_primary,
      color_secondary: parsed.color_secondary,
      color_accent: parsed.color_accent,
      is_default: true,
      is_complete: isComplete,
      updated_at: new Date().toISOString(),
    }

    let profileId = parsed.id

    if (profileId) {
      const { data, error } = await supabase
        .from("brand_profiles")
        .update(formPayload)
        .eq("id", profileId)
        .eq("user_id", workspaceUserId)
        .select("*")
        .single()

      if (error || !data) {
        throw new AppError({
          code: "INTERNAL",
          message: error?.message ?? "Update failed",
          userMessage: "Failed to save brand profile.",
        })
      }

      revalidatePath(SETTINGS_PATH)
      return { success: true, data }
    }

    const defaults = getDefaultBrandProfile(workspaceUserId)
    const { data, error } = await supabase
      .from("brand_profiles")
      .insert({
        ...defaults,
        ...formPayload,
      })
      .select("*")
      .single()

    if (error || !data) {
      throw new AppError({
        code: "INTERNAL",
        message: error?.message ?? "Insert failed",
        userMessage: "Failed to save brand profile.",
      })
    }

    revalidatePath(SETTINGS_PATH)
    return { success: true, data }
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.userMessage }
    }

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? "Please check the form for validation errors.",
      }
    }

    return {
      success: false,
      error: AppError.fromUnknown(error).userMessage,
    }
  }
}

export async function extractBrandFromUrl(
  url: string,
): Promise<ActionResult<BrandExtractResult>> {
  try {
    const parsed = extractBrandFromUrlSchema.parse({ url })
    const userId = await getWorkspaceUserId()
    const [settings, existingProfile] = await Promise.all([
      loadSettings(userId),
      getBrandProfile(),
    ])

    const defaults = getBrandProfileDefaultValues(
      userId,
      existingProfile.success ? existingProfile.data : null,
    )

    const html = await fetchPageHtml(parsed.url)
    const pageText = prepareTextContent(html)
    const extracted = await extractBrandInfoFromPageText(
      pageText,
      settings,
      defaults,
    )

    if (!extracted.brand_name.trim()) {
      return {
        success: false,
        error:
          "Could not detect a brand name from that page. Try another URL or fill the form manually.",
      }
    }

    return { success: true, data: extracted }
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.userMessage }
    }

    if (error instanceof Error && error.name === "ZodError") {
      return { success: false, error: "Enter a valid website URL." }
    }

    return {
      success: false,
      error: AppError.fromUnknown(error).userMessage,
    }
  }
}

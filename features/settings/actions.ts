"use server"

import { revalidatePath } from "next/cache"

import { z } from "zod"

import { requireAuth } from "@/lib/auth/require-auth"
import { getWorkspaceUserId } from "@/lib/auth/workspace"
import { AppError } from "@/lib/errors/app-error"
import {
  aiSettingsSchema,
  appSettingsSchema,
  type AiSettingsFormValues,
  type AppSettingsFormValues,
} from "@/lib/validations/settings"
import { createClient } from "@/services/supabase/server"
import { hasEnvOpenAiApiKey } from "@/services/ai/env"
import type {
  ActionResult,
  PlatformRow,
  PlatformWithConnection,
  SettingsBundle,
} from "@/types/app"
import type { TablesInsert } from "@/types/database"

const SETTINGS_PATH = "/settings"

const DEFAULT_SETTINGS: Omit<
  TablesInsert<"settings">,
  "user_id" | "id" | "created_at" | "updated_at"
> = {
  timezone: "UTC",
  date_format: "MM/dd/yyyy",
  default_post_status: "draft",
  default_platform_ids: [],
  text_ai_provider: "gemini",
  openai_model: "gpt-4o-mini",
  openai_temperature: 0.7,
  openai_max_tokens: 1024,
  gemini_model: "gemini-2.5-flash",
  gemini_image_size: "1024x1024",
  gemini_image_style: "natural",
  default_text_prompt: "",
  default_image_prompt: "",
  default_text_length_prompt: "",
}

async function ensureSettings(userId: string): Promise<SettingsBundle> {
  const supabase = await createClient()

  const { data: existing, error: fetchError } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  if (fetchError) {
    throw new AppError({
      code: "INTERNAL",
      message: fetchError.message,
      userMessage: "Failed to load settings.",
    })
  }

  if (existing) {
    return existing
  }

  const { data: created, error: createError } = await supabase
    .from("settings")
    .insert({
      user_id: userId,
      ...DEFAULT_SETTINGS,
    })
    .select("*")
    .single()

  if (createError || !created) {
    throw new AppError({
      code: "INTERNAL",
      message: createError?.message ?? "Insert failed",
      userMessage: "Failed to initialize settings.",
    })
  }

  return created
}

export async function getSettings(): Promise<ActionResult<SettingsBundle>> {
  try {
    const workspaceUserId = await getWorkspaceUserId()
    const settings = await ensureSettings(workspaceUserId)
    return { success: true, data: settings }
  } catch (error) {
    return {
      success: false,
      error: AppError.fromUnknown(error).userMessage,
    }
  }
}

export async function updateAiSettings(
  values: AiSettingsFormValues,
): Promise<ActionResult<SettingsBundle>> {
  try {
    const parsed = aiSettingsSchema.parse(values)
    const textAiProvider =
      parsed.text_ai_provider === "openai" && !hasEnvOpenAiApiKey()
        ? "gemini"
        : parsed.text_ai_provider

    const workspaceUserId = await getWorkspaceUserId()
    const supabase = await createClient()
    await ensureSettings(workspaceUserId)

    const { data, error } = await supabase
      .from("settings")
      .update({
        text_ai_provider: textAiProvider,
        openai_model: parsed.openai_model,
        openai_temperature: parsed.openai_temperature,
        openai_max_tokens: parsed.openai_max_tokens,
        gemini_model: parsed.gemini_model,
        gemini_image_size: parsed.gemini_image_size,
        gemini_image_style: parsed.gemini_image_style,
        default_text_prompt: parsed.default_text_prompt.trim(),
        default_image_prompt: parsed.default_image_prompt.trim(),
        default_text_length_prompt: parsed.default_text_length_prompt.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", workspaceUserId)
      .select("*")
      .single()

    if (error || !data) {
      throw new AppError({
        code: "INTERNAL",
        message: error?.message ?? "Update failed",
        userMessage: "Failed to save AI settings.",
      })
    }

    revalidatePath(SETTINGS_PATH)
    return { success: true, data }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Please check the AI settings form for validation errors.",
      }
    }

    return {
      success: false,
      error: AppError.fromUnknown(error).userMessage,
    }
  }
}

export async function updateAppSettings(
  values: AppSettingsFormValues,
): Promise<ActionResult<SettingsBundle>> {
  try {
    const parsed = appSettingsSchema.parse(values)
    const workspaceUserId = await getWorkspaceUserId()
    const supabase = await createClient()
    await ensureSettings(workspaceUserId)

    const { data, error } = await supabase
      .from("settings")
      .update({
        timezone: parsed.timezone,
        date_format: parsed.date_format,
        default_post_status: parsed.default_post_status,
        default_platform_ids: parsed.default_platform_ids,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", workspaceUserId)
      .select("*")
      .single()

    if (error || !data) {
      throw new AppError({
        code: "INTERNAL",
        message: error?.message ?? "Update failed",
        userMessage: "Failed to save application settings.",
      })
    }

    revalidatePath(SETTINGS_PATH)
    return { success: true, data }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Please check the application settings form for validation errors.",
      }
    }

    return {
      success: false,
      error: AppError.fromUnknown(error).userMessage,
    }
  }
}

export async function getEnabledPlatforms(): Promise<ActionResult<PlatformRow[]>> {
  try {
    await requireAuth()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("platforms")
      .select("*")
      .eq("is_enabled", true)
      .order("sort_order", { ascending: true })

    if (error) {
      throw new AppError({
        code: "INTERNAL",
        message: error.message,
        userMessage: "Failed to load platforms.",
      })
    }

    return { success: true, data: data ?? [] }
  } catch (error) {
    return {
      success: false,
      error: AppError.fromUnknown(error).userMessage,
    }
  }
}

export async function getPlatformConnections(): Promise<
  ActionResult<PlatformWithConnection[]>
> {
  try {
    const workspaceUserId = await getWorkspaceUserId()
    const supabase = await createClient()

    const [platformsResult, connectionsResult] = await Promise.all([
      supabase
        .from("platforms")
        .select("*")
        .eq("is_enabled", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("platform_connections")
        .select("*")
        .eq("user_id", workspaceUserId),
    ])

    if (platformsResult.error) {
      throw new AppError({
        code: "INTERNAL",
        message: platformsResult.error.message,
        userMessage: "Failed to load platforms.",
      })
    }

    if (connectionsResult.error) {
      throw new AppError({
        code: "INTERNAL",
        message: connectionsResult.error.message,
        userMessage: "Failed to load platform connections.",
      })
    }

    const connectionByPlatform = new Map(
      (connectionsResult.data ?? []).map((connection) => [
        connection.platform_id,
        connection,
      ]),
    )

    const platformsWithConnections: PlatformWithConnection[] = (
      platformsResult.data ?? []
    ).map((platform) => ({
      ...platform,
      connection: connectionByPlatform.get(platform.id) ?? null,
    }))

    return { success: true, data: platformsWithConnections }
  } catch (error) {
    return {
      success: false,
      error: AppError.fromUnknown(error).userMessage,
    }
  }
}

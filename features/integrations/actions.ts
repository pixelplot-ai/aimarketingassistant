"use server"

import { randomBytes } from "crypto"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

import { getOAuthRedirectUri } from "@/features/integrations/facebook/config"
import {
  buildFacebookTokensFromEnv,
  hasEnvFacebookPageToken,
} from "@/features/integrations/facebook/env-token"
import "@/features/integrations/registry"
import {
  getAllConnectors,
  getConnector,
  isSupportedPlatform,
} from "@/features/integrations/registry"
import { IntegrationError } from "@/features/integrations/shared/errors"
import {
  decryptToken,
  encryptToken,
} from "@/features/integrations/shared/token-encryption"
import type { PlatformConnectionView } from "@/features/integrations/types"
import { requireAuth } from "@/lib/auth/require-auth"
import { getWorkspaceUserId } from "@/lib/auth/workspace"
import { AppError } from "@/lib/errors/app-error"
import { createClient } from "@/services/supabase/server"
import type { ActionResult } from "@/types/app"
import type { Json, Tables } from "@/types/database"

const SETTINGS_PATH = "/settings"
const OAUTH_STATE_COOKIE = "oauth_state"
const OAUTH_STATE_MAX_AGE = 60 * 10

function toActionError(error: unknown): ActionResult<never> {
  if (AppError.isAppError(error)) {
    return { success: false, error: error.userMessage }
  }
  if (error instanceof Error) {
    return { success: false, error: error.message }
  }
  return { success: false, error: "Something went wrong. Please try again." }
}

function mapConnection(row: Tables<"platform_connections">): PlatformConnectionView {
  return {
    id: row.id,
    platformId: row.platform_id,
    accountName: row.account_name,
    status: row.status,
    tokenExpiresAt: row.token_expires_at,
    externalAccountId: row.external_account_id,
  }
}

async function setOAuthState(platformId: string, state: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(`${OAUTH_STATE_COOKIE}_${platformId}`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: OAUTH_STATE_MAX_AGE,
    path: "/",
  })
}

export async function connectPlatform(
  platformId: string,
): Promise<ActionResult<{ authUrl: string }>> {
  try {
    await requireAuth()

    if (!isSupportedPlatform(platformId)) {
      throw IntegrationError.platformNotSupported(platformId)
    }

    if (platformId === "facebook" && hasEnvFacebookPageToken()) {
      throw new AppError({
        code: "VALIDATION",
        message: "Use connectFacebookWithEnvToken for env token flow",
        userMessage:
          "Facebook is configured with an access token. Use “Connect with access token” instead.",
      })
    }

    const connector = getConnector(platformId)
    const state = randomBytes(24).toString("hex")
    await setOAuthState(platformId, state)

    const redirectUri = getOAuthRedirectUri(platformId)
    const authUrl = connector.getAuthUrl(state, redirectUri)

    return { success: true, data: { authUrl } }
  } catch (error) {
    return toActionError(error)
  }
}

/** Connect Facebook using FACEBOOK_PAGE_ACCESS_TOKEN (same approach as n8n). */
export async function connectFacebookWithEnvToken(): Promise<ActionResult> {
  try {
    const workspaceUserId = await getWorkspaceUserId()

    if (!hasEnvFacebookPageToken()) {
      throw new AppError({
        code: "VALIDATION",
        message: "FACEBOOK_PAGE_ACCESS_TOKEN missing",
        userMessage:
          "Add FACEBOOK_PAGE_ACCESS_TOKEN to your server environment (Vercel), then redeploy.",
      })
    }

    const tokens = await buildFacebookTokensFromEnv()
    await upsertPlatformConnectionFromOAuth(workspaceUserId, "facebook", tokens)

    revalidatePath(SETTINGS_PATH)
    return { success: true, data: undefined }
  } catch (error) {
    return toActionError(error)
  }
}

export async function disconnectPlatform(
  platformId: string,
): Promise<ActionResult> {
  try {
    const workspaceUserId = await getWorkspaceUserId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("platform_connections")
      .update({
        status: "disconnected",
        access_token_encrypted: null,
        refresh_token_encrypted: null,
        token_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", workspaceUserId)
      .eq("platform_id", platformId)
      .select("id")
      .maybeSingle()

    if (error) {
      throw new AppError({
        code: "INTERNAL",
        message: error.message,
        userMessage: "Failed to disconnect platform.",
      })
    }

    if (!data) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Connection not found",
        userMessage: "No connection found for this platform.",
      })
    }

    revalidatePath(SETTINGS_PATH)
    return { success: true, data: undefined }
  } catch (error) {
    return toActionError(error)
  }
}

export async function refreshConnection(
  platformId: string,
): Promise<ActionResult<PlatformConnectionView>> {
  try {
    const workspaceUserId = await getWorkspaceUserId()
    const supabase = await createClient()

    const { data: connection, error: fetchError } = await supabase
      .from("platform_connections")
      .select("*")
      .eq("user_id", workspaceUserId)
      .eq("platform_id", platformId)
      .maybeSingle()

    if (fetchError) {
      throw new AppError({
        code: "INTERNAL",
        message: fetchError.message,
        userMessage: "Failed to load connection.",
      })
    }

    if (!connection?.refresh_token_encrypted && !connection?.access_token_encrypted) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Connection not found",
        userMessage: "No active connection to refresh.",
      })
    }

    const connector = getConnector(platformId)
    const metadata = (connection.metadata ?? {}) as Record<string, unknown>
    const refreshSource =
      connection.refresh_token_encrypted ??
      (metadata.userAccessToken
        ? encryptToken(String(metadata.userAccessToken))
        : connection.access_token_encrypted)

    if (!refreshSource) {
      throw new AppError({
        code: "VALIDATION",
        message: "No refresh token available",
        userMessage: "Reconnect this platform to refresh credentials.",
      })
    }

    const refreshToken = decryptToken(refreshSource)
    const tokens = await connector.refreshTokens(refreshToken)
    const accountInfo = connector.getAccountInfo
      ? await connector.getAccountInfo(tokens.accessToken)
      : {
          externalAccountId: tokens.externalAccountId ?? connection.external_account_id ?? "",
          accountName: tokens.accountName ?? connection.account_name,
          metadata: tokens.metadata,
        }

    const { data: updated, error: updateError } = await supabase
      .from("platform_connections")
      .update({
        access_token_encrypted: encryptToken(tokens.accessToken),
        refresh_token_encrypted: tokens.refreshToken
          ? encryptToken(tokens.refreshToken)
          : connection.refresh_token_encrypted,
        token_expires_at: tokens.expiresAt?.toISOString() ?? null,
        external_account_id: accountInfo.externalAccountId,
        account_name: accountInfo.accountName,
        metadata: {
          ...metadata,
          ...(accountInfo.metadata ?? {}),
          ...(tokens.metadata ?? {}),
        } as Json,
        scopes: tokens.scopes ?? connection.scopes,
        status: "connected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id)
      .select("*")
      .single()

    if (updateError || !updated) {
      throw new AppError({
        code: "INTERNAL",
        message: updateError?.message ?? "Update failed",
        userMessage: "Failed to refresh connection.",
      })
    }

    revalidatePath(SETTINGS_PATH)
    return { success: true, data: mapConnection(updated) }
  } catch (error) {
    return toActionError(error)
  }
}

export async function getConnections(): Promise<
  ActionResult<PlatformConnectionView[]>
> {
  try {
    const workspaceUserId = await getWorkspaceUserId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("platform_connections")
      .select("*")
      .eq("user_id", workspaceUserId)
      .neq("status", "disconnected")

    if (error) {
      throw new AppError({
        code: "INTERNAL",
        message: error.message,
        userMessage: "Failed to load connections.",
      })
    }

    return {
      success: true,
      data: (data ?? []).map(mapConnection),
    }
  } catch (error) {
    return toActionError(error)
  }
}

export async function getRegisteredPlatforms(): Promise<
  ActionResult<{ id: string; displayName: string }[]>
> {
  try {
    await requireAuth()
    return {
      success: true,
      data: getAllConnectors().map((connector) => ({
        id: connector.platformId,
        displayName: connector.displayName,
      })),
    }
  } catch (error) {
    return toActionError(error)
  }
}

export async function upsertPlatformConnectionFromOAuth(
  userId: string,
  platformId: string,
  tokens: Awaited<
    ReturnType<ReturnType<typeof getConnector>["exchangeCode"]>
  >,
): Promise<Tables<"platform_connections">> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("platform_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("platform_id", platformId)
    .maybeSingle()

  const payload = {
    user_id: userId,
    platform_id: platformId,
    access_token_encrypted: encryptToken(tokens.accessToken),
    refresh_token_encrypted: tokens.refreshToken
      ? encryptToken(tokens.refreshToken)
      : null,
    token_expires_at: tokens.expiresAt?.toISOString() ?? null,
    external_account_id: tokens.externalAccountId ?? null,
    account_name: tokens.accountName ?? null,
    metadata: (tokens.metadata ?? {}) as Json,
    scopes: tokens.scopes ?? [],
    status: "connected" as const,
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    const { data, error } = await supabase
      .from("platform_connections")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single()

    if (error || !data) {
      throw new AppError({
        code: "INTERNAL",
        message: error?.message ?? "Update failed",
        userMessage: "Failed to save platform connection.",
      })
    }

    return data
  }

  const { data, error } = await supabase
    .from("platform_connections")
    .insert(payload)
    .select("*")
    .single()

  if (error || !data) {
    throw new AppError({
      code: "INTERNAL",
      message: error?.message ?? "Insert failed",
      userMessage: "Failed to save platform connection.",
    })
  }

  return data
}

export async function verifyOAuthState(
  platformId: string,
  state: string | null,
): Promise<boolean> {
  if (!state) {
    return false
  }

  const cookieStore = await cookies()
  const stored = cookieStore.get(`${OAUTH_STATE_COOKIE}_${platformId}`)?.value
  cookieStore.delete(`${OAUTH_STATE_COOKIE}_${platformId}`)
  return Boolean(stored && stored === state)
}

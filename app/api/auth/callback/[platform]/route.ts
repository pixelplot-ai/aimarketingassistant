import { NextResponse } from "next/server"

import {
  upsertPlatformConnectionFromOAuth,
  verifyOAuthState,
} from "@/features/integrations/actions"
import { getOAuthRedirectUri } from "@/features/integrations/facebook/config"
import "@/features/integrations/registry"
import {
  getConnector,
  isSupportedPlatform,
} from "@/features/integrations/registry"
import { IntegrationError } from "@/features/integrations/shared/errors"
import { requireAuth } from "@/lib/auth/require-auth"
import { getWorkspaceUserId } from "@/lib/auth/workspace"

type RouteContext = {
  params: Promise<{ platform: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { platform } = await context.params
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const oauthError = searchParams.get("error")

  const settingsUrl = `${origin}/settings?tab=social`

  if (oauthError) {
    return NextResponse.redirect(
      `${settingsUrl}&error=${encodeURIComponent(oauthError)}`,
    )
  }

  if (!isSupportedPlatform(platform)) {
    return NextResponse.redirect(
      `${settingsUrl}&error=${encodeURIComponent("unsupported_platform")}`,
    )
  }

  if (!code) {
    return NextResponse.redirect(
      `${settingsUrl}&error=${encodeURIComponent("missing_code")}`,
    )
  }

  const stateValid = await verifyOAuthState(platform, state)
  if (!stateValid) {
    return NextResponse.redirect(
      `${settingsUrl}&error=${encodeURIComponent("invalid_state")}`,
    )
  }

  try {
    await requireAuth()
    const workspaceUserId = await getWorkspaceUserId()
    const connector = getConnector(platform)
    const redirectUri = getOAuthRedirectUri(platform)
    const tokens = await connector.exchangeCode(code, redirectUri)

    await upsertPlatformConnectionFromOAuth(workspaceUserId, platform, tokens)

    return NextResponse.redirect(`${settingsUrl}&connected=${platform}`)
  } catch (error) {
    const message =
      error instanceof IntegrationError
        ? error.userMessage
        : error instanceof Error
          ? error.message
          : "oauth_failed"

    return NextResponse.redirect(
      `${settingsUrl}&error=${encodeURIComponent(message)}`,
    )
  }
}

import { graphRequest } from "@/features/integrations/facebook/meta-graph-client"
import { IntegrationError } from "@/features/integrations/shared/errors"
import type { OAuthTokens } from "@/features/integrations/types"

const FACEBOOK_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "public_profile",
]

export function hasEnvFacebookPageToken(): boolean {
  return Boolean(process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim())
}

export function getEnvFacebookPageAccessToken(): string {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim()
  if (!token) {
    throw new IntegrationError({
      code: "VALIDATION",
      message: "FACEBOOK_PAGE_ACCESS_TOKEN is not configured",
      userMessage:
        "Facebook Page access token is not configured on the server.",
    })
  }
  return token
}

async function resolvePageFromToken(
  accessToken: string,
): Promise<{ id: string; name: string }> {
  const configuredPageId = process.env.FACEBOOK_PAGE_ID?.trim()
  const configuredPageName = process.env.FACEBOOK_PAGE_NAME?.trim()

  if (configuredPageId) {
    if (configuredPageName) {
      return { id: configuredPageId, name: configuredPageName }
    }

    const page = await graphRequest<{ id: string; name: string }>(
      `/${configuredPageId}`,
      {
        accessToken,
        params: { fields: "id,name" },
      },
    )

    return { id: page.id, name: page.name }
  }

  const identity = await graphRequest<{ id: string; name: string }>("/me", {
    accessToken,
    params: { fields: "id,name" },
  })

  if (!identity.id) {
    throw new IntegrationError({
      code: "OAUTH_FAILED",
      message: "Token validation returned no page id",
      userMessage: "Facebook token is invalid or expired.",
    })
  }

  return { id: identity.id, name: identity.name }
}

export async function buildFacebookTokensFromEnv(): Promise<OAuthTokens> {
  const accessToken = getEnvFacebookPageAccessToken()
  const page = await resolvePageFromToken(accessToken)

  return {
    accessToken,
    refreshToken: null,
    expiresAt: null,
    scopes: FACEBOOK_SCOPES,
    externalAccountId: page.id,
    accountName: page.name,
    metadata: {
      pageId: page.id,
      source: "env_page_token",
    },
  }
}

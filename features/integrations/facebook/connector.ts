import {
  buildMetaOAuthUrl,
  getOAuthRedirectUri,
  isMetaDevStubMode,
} from "@/features/integrations/facebook/config"
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  graphRequest,
} from "@/features/integrations/facebook/meta-graph-client"
import type {
  ConnectionContext,
  OAuthTokens,
  PublishInput,
  PublishResult,
  SocialPlatformConnector,
} from "@/features/integrations/types"

const FACEBOOK_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "public_profile",
]

type FacebookPage = {
  id: string
  name: string
  access_token?: string
}

type MeAccountsResponse = {
  data: FacebookPage[]
}

async function resolvePrimaryPage(accessToken: string): Promise<FacebookPage> {
  const response = await graphRequest<MeAccountsResponse>("/me/accounts", {
    accessToken,
  })

  const page = response.data?.[0]
  if (!page) {
    throw new Error("No Facebook Pages found for this account")
  }

  return page
}

function buildDevStubTokens(): OAuthTokens {
  return {
    accessToken: "dev_facebook_access_token",
    refreshToken: null,
    expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    scopes: FACEBOOK_SCOPES,
    externalAccountId: "dev_facebook_page",
    accountName: "Dev Facebook Page",
    metadata: { devStub: true },
  }
}

export const facebookConnector: SocialPlatformConnector = {
  platformId: "facebook",
  displayName: "Facebook",

  getAuthUrl(state: string, redirectUri: string): string {
    if (isMetaDevStubMode()) {
      const params = new URLSearchParams({
        code: "dev_stub",
        state,
      })
      return `${redirectUri}?${params.toString()}`
    }

    return buildMetaOAuthUrl({
      state,
      redirectUri,
      scope: FACEBOOK_SCOPES.join(","),
    })
  },

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    if (isMetaDevStubMode() || code === "dev_stub") {
      return buildDevStubTokens()
    }

    const shortLived = await exchangeCodeForToken(code, redirectUri)
    const longLived = await exchangeForLongLivedToken(shortLived.access_token)
    const page = await resolvePrimaryPage(longLived.access_token)

    const expiresAt = longLived.expires_in
      ? new Date(Date.now() + longLived.expires_in * 1000)
      : null

    return {
      accessToken: page.access_token ?? longLived.access_token,
      refreshToken: null,
      expiresAt,
      scopes: FACEBOOK_SCOPES,
      externalAccountId: page.id,
      accountName: page.name,
      metadata: {
        pageId: page.id,
        userAccessToken: longLived.access_token,
      },
    }
  },

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    if (isMetaDevStubMode()) {
      return buildDevStubTokens()
    }

    const longLived = await exchangeForLongLivedToken(refreshToken)
    const page = await resolvePrimaryPage(longLived.access_token)

    return {
      accessToken: page.access_token ?? longLived.access_token,
      refreshToken,
      expiresAt: longLived.expires_in
        ? new Date(Date.now() + longLived.expires_in * 1000)
        : null,
      scopes: FACEBOOK_SCOPES,
      externalAccountId: page.id,
      accountName: page.name,
      metadata: {
        pageId: page.id,
        userAccessToken: longLived.access_token,
      },
    }
  },

  async getAccountInfo(accessToken: string): Promise<ConnectionContext> {
    if (isMetaDevStubMode()) {
      return {
        externalAccountId: "dev_facebook_page",
        accountName: "Dev Facebook Page",
        metadata: { devStub: true },
      }
    }

    const page = await resolvePrimaryPage(accessToken)
    return {
      externalAccountId: page.id,
      accountName: page.name,
      metadata: { pageId: page.id },
    }
  },

  async publish(
    accessToken: string,
    input: PublishInput,
    connection: ConnectionContext,
  ): Promise<PublishResult> {
    const pageId =
      (connection.metadata?.pageId as string | undefined) ??
      connection.externalAccountId

    if (isMetaDevStubMode()) {
      return {
        success: true,
        externalPostId: `dev_fb_${Date.now()}`,
        requestPayload: {
          pageId,
          message: input.text,
          imageUrl: input.imageUrl ?? null,
        },
        responsePayload: {
          id: `dev_fb_${Date.now()}`,
          devStub: true,
        },
      }
    }

    try {
      if (input.imageUrl) {
        const response = await graphRequest<{ id: string; post_id?: string }>(
          `/${pageId}/photos`,
          {
            method: "POST",
            accessToken,
            params: {
              url: input.imageUrl,
              caption: input.text,
            },
          },
        )

        return {
          success: true,
          externalPostId: response.post_id ?? response.id,
          requestPayload: {
            pageId,
            url: input.imageUrl,
            caption: input.text,
          },
          responsePayload: response as Record<string, unknown>,
        }
      }

      const response = await graphRequest<{ id: string }>(`/${pageId}/feed`, {
        method: "POST",
        accessToken,
        params: {
          message: input.text,
        },
      })

      return {
        success: true,
        externalPostId: response.id,
        requestPayload: { pageId, message: input.text },
        responsePayload: response as Record<string, unknown>,
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Facebook publish failed"
      return {
        success: false,
        error: message,
        requestPayload: {
          pageId,
          message: input.text,
          imageUrl: input.imageUrl ?? null,
        },
      }
    }
  },
}

export function getFacebookOAuthRedirectUri(): string {
  return getOAuthRedirectUri("facebook")
}

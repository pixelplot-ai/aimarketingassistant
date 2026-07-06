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

const INSTAGRAM_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "public_profile",
]

type InstagramAccount = {
  id: string
  username?: string
}

type PageWithInstagram = {
  id: string
  name: string
  access_token?: string
  instagram_business_account?: InstagramAccount
}

type MeAccountsResponse = {
  data: PageWithInstagram[]
}

async function resolveInstagramAccount(
  accessToken: string,
): Promise<{ page: PageWithInstagram; igAccount: InstagramAccount }> {
  const response = await graphRequest<MeAccountsResponse>("/me/accounts", {
    accessToken,
    params: {
      fields: "id,name,access_token,instagram_business_account{id,username}",
    },
  })

  for (const page of response.data ?? []) {
    if (page.instagram_business_account?.id) {
      return { page, igAccount: page.instagram_business_account }
    }
  }

  throw new Error("No Instagram Business account linked to Facebook Pages")
}

function buildDevStubTokens(): OAuthTokens {
  return {
    accessToken: "dev_instagram_access_token",
    refreshToken: null,
    expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    scopes: INSTAGRAM_SCOPES,
    externalAccountId: "dev_instagram_account",
    accountName: "Dev Instagram Account",
    metadata: {
      devStub: true,
      igUserId: "dev_instagram_account",
      pageId: "dev_facebook_page",
    },
  }
}

export const instagramConnector: SocialPlatformConnector = {
  platformId: "instagram",
  displayName: "Instagram",

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
      scope: INSTAGRAM_SCOPES.join(","),
    })
  },

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    if (isMetaDevStubMode() || code === "dev_stub") {
      return buildDevStubTokens()
    }

    const shortLived = await exchangeCodeForToken(code, redirectUri)
    const longLived = await exchangeForLongLivedToken(shortLived.access_token)
    const { page, igAccount } = await resolveInstagramAccount(longLived.access_token)

    const expiresAt = longLived.expires_in
      ? new Date(Date.now() + longLived.expires_in * 1000)
      : null

    return {
      accessToken: page.access_token ?? longLived.access_token,
      refreshToken: null,
      expiresAt,
      scopes: INSTAGRAM_SCOPES,
      externalAccountId: igAccount.id,
      accountName: igAccount.username ?? page.name,
      metadata: {
        igUserId: igAccount.id,
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
    const { page, igAccount } = await resolveInstagramAccount(longLived.access_token)

    return {
      accessToken: page.access_token ?? longLived.access_token,
      refreshToken,
      expiresAt: longLived.expires_in
        ? new Date(Date.now() + longLived.expires_in * 1000)
        : null,
      scopes: INSTAGRAM_SCOPES,
      externalAccountId: igAccount.id,
      accountName: igAccount.username ?? page.name,
      metadata: {
        igUserId: igAccount.id,
        pageId: page.id,
        userAccessToken: longLived.access_token,
      },
    }
  },

  async getAccountInfo(accessToken: string): Promise<ConnectionContext> {
    if (isMetaDevStubMode()) {
      return {
        externalAccountId: "dev_instagram_account",
        accountName: "Dev Instagram Account",
        metadata: {
          devStub: true,
          igUserId: "dev_instagram_account",
        },
      }
    }

    const { page, igAccount } = await resolveInstagramAccount(accessToken)
    return {
      externalAccountId: igAccount.id,
      accountName: igAccount.username ?? page.name,
      metadata: {
        igUserId: igAccount.id,
        pageId: page.id,
      },
    }
  },

  async publish(
    accessToken: string,
    input: PublishInput,
    connection: ConnectionContext,
  ): Promise<PublishResult> {
    const igUserId =
      (connection.metadata?.igUserId as string | undefined) ??
      connection.externalAccountId

    if (isMetaDevStubMode()) {
      return {
        success: true,
        externalPostId: `dev_ig_${Date.now()}`,
        requestPayload: {
          igUserId,
          caption: input.text,
          imageUrl: input.imageUrl ?? null,
        },
        responsePayload: {
          id: `dev_ig_${Date.now()}`,
          devStub: true,
        },
      }
    }

    if (!input.imageUrl) {
      return {
        success: false,
        error: "Instagram requires an image URL to publish",
        requestPayload: { igUserId, caption: input.text },
      }
    }

    try {
      const container = await graphRequest<{ id: string }>(
        `/${igUserId}/media`,
        {
          method: "POST",
          accessToken,
          params: {
            image_url: input.imageUrl,
            caption: input.text,
          },
        },
      )

      const published = await graphRequest<{ id: string }>(
        `/${igUserId}/media_publish`,
        {
          method: "POST",
          accessToken,
          params: {
            creation_id: container.id,
          },
        },
      )

      return {
        success: true,
        externalPostId: published.id,
        requestPayload: {
          igUserId,
          image_url: input.imageUrl,
          caption: input.text,
        },
        responsePayload: published as Record<string, unknown>,
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Instagram publish failed"
      return {
        success: false,
        error: message,
        requestPayload: {
          igUserId,
          caption: input.text,
          imageUrl: input.imageUrl,
        },
      }
    }
  },
}

export function getInstagramOAuthRedirectUri(): string {
  return getOAuthRedirectUri("instagram")
}

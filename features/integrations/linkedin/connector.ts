import {
  buildLinkedInOAuthUrl,
  getLinkedInOAuthRedirectUri,
  isLinkedInDevStubMode,
  LINKEDIN_SCOPES,
} from "@/features/integrations/linkedin/config"
import {
  createLinkedInPost,
  exchangeLinkedInCode,
  refreshLinkedInToken,
  resolveLinkedInMemberProfile,
  uploadLinkedInImageFromUrl,
} from "@/features/integrations/linkedin/linkedin-api-client"
import { IntegrationError } from "@/features/integrations/shared/errors"
import type {
  ConnectionContext,
  OAuthTokens,
  PublishInput,
  PublishResult,
  SocialPlatformConnector,
} from "@/features/integrations/types"

function toAuthorUrn(personId: string): string {
  return personId.startsWith("urn:li:person:")
    ? personId
    : `urn:li:person:${personId}`
}

function buildLinkedInMetadata(personId: string) {
  return {
    authorUrn: toAuthorUrn(personId),
    personId,
  }
}

function buildDevStubTokens(): OAuthTokens {
  return {
    accessToken: "dev_linkedin_access_token",
    refreshToken: "dev_linkedin_refresh_token",
    expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    scopes: [...LINKEDIN_SCOPES],
    externalAccountId: "dev_linkedin_person",
    accountName: "Dev LinkedIn Profile",
    metadata: {
      devStub: true,
      ...buildLinkedInMetadata("dev_linkedin_person"),
    },
  }
}

function tokensFromOAuthResponse(
  tokenResponse: Awaited<ReturnType<typeof exchangeLinkedInCode>>,
  profile: Awaited<ReturnType<typeof resolveLinkedInMemberProfile>>,
): OAuthTokens {
  const scopes = tokenResponse.scope
    ? tokenResponse.scope.split(/\s+/).filter(Boolean)
    : [...LINKEDIN_SCOPES]

  return {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token ?? null,
    expiresAt: tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : null,
    scopes,
    externalAccountId: profile.personId,
    accountName: profile.accountName,
    metadata: buildLinkedInMetadata(profile.personId),
  }
}

export const linkedinConnector: SocialPlatformConnector = {
  platformId: "linkedin",
  displayName: "LinkedIn",

  getAuthUrl(state: string, redirectUri: string): string {
    if (isLinkedInDevStubMode()) {
      const params = new URLSearchParams({
        code: "dev_stub",
        state,
      })
      return `${redirectUri}?${params.toString()}`
    }

    return buildLinkedInOAuthUrl({ state, redirectUri })
  },

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    if (isLinkedInDevStubMode() || code === "dev_stub") {
      return buildDevStubTokens()
    }

    const tokenResponse = await exchangeLinkedInCode(code, redirectUri)
    const profile = await resolveLinkedInMemberProfile({
      accessToken: tokenResponse.access_token,
      idToken: tokenResponse.id_token,
    })

    return tokensFromOAuthResponse(tokenResponse, profile)
  },

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    if (isLinkedInDevStubMode()) {
      return buildDevStubTokens()
    }

    const tokenResponse = await refreshLinkedInToken(refreshToken)
    const profile = await resolveLinkedInMemberProfile({
      accessToken: tokenResponse.access_token,
      idToken: tokenResponse.id_token,
    })

    return tokensFromOAuthResponse(tokenResponse, profile)
  },

  async getAccountInfo(accessToken: string): Promise<ConnectionContext> {
    if (isLinkedInDevStubMode()) {
      return {
        externalAccountId: "dev_linkedin_person",
        accountName: "Dev LinkedIn Profile",
        metadata: {
          devStub: true,
          ...buildLinkedInMetadata("dev_linkedin_person"),
        },
      }
    }

    const profile = await resolveLinkedInMemberProfile({ accessToken })

    return {
      externalAccountId: profile.personId,
      accountName: profile.accountName,
      metadata: buildLinkedInMetadata(profile.personId),
    }
  },

  async publish(
    accessToken: string,
    input: PublishInput,
    connection: ConnectionContext,
  ): Promise<PublishResult> {
    const personId =
      (connection.metadata?.personId as string | undefined) ??
      connection.externalAccountId
    const authorUrn =
      (connection.metadata?.authorUrn as string | undefined) ??
      toAuthorUrn(personId)

    if (isLinkedInDevStubMode()) {
      return {
        success: true,
        externalPostId: `dev_li_${Date.now()}`,
        requestPayload: {
          authorUrn,
          commentary: input.text,
          imageUrl: input.imageUrl ?? null,
        },
        responsePayload: {
          id: `dev_li_${Date.now()}`,
          devStub: true,
        },
      }
    }

    try {
      let imageUrn: string | null = null

      if (input.imageUrl) {
        imageUrn = await uploadLinkedInImageFromUrl(
          accessToken,
          authorUrn,
          input.imageUrl,
        )
      }

      const { postId, responseBody } = await createLinkedInPost(accessToken, {
        authorUrn,
        commentary: input.text,
        imageUrn,
      })

      return {
        success: true,
        externalPostId: postId,
        requestPayload: {
          authorUrn,
          commentary: input.text,
          imageUrl: input.imageUrl ?? null,
          imageUrn,
        },
        responsePayload: responseBody,
      }
    } catch (error) {
      const message =
        error instanceof IntegrationError
          ? error.userMessage
          : error instanceof Error
            ? error.message
            : "LinkedIn publish failed"

      return {
        success: false,
        error: message,
        requestPayload: {
          authorUrn,
          commentary: input.text,
          imageUrl: input.imageUrl ?? null,
        },
      }
    }
  },
}

export function getLinkedInOAuthRedirectUriFromConnector(): string {
  return getLinkedInOAuthRedirectUri()
}

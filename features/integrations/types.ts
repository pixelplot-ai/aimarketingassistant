import type { Enums } from "@/types/database"

export type PlatformId = "facebook" | "instagram" | "linkedin"

export type ConnectionStatus = Enums<"connection_status">

export interface PublishInput {
  text: string
  imageUrl?: string | null
}

export interface PublishResult {
  success: boolean
  externalPostId?: string
  error?: string
  requestPayload?: Record<string, unknown>
  responsePayload?: Record<string, unknown>
}

export interface OAuthTokens {
  accessToken: string
  refreshToken?: string | null
  expiresAt?: Date | null
  scopes?: string[]
  externalAccountId?: string | null
  accountName?: string | null
  metadata?: Record<string, unknown>
}

export interface ConnectionContext {
  externalAccountId: string
  accountName: string | null
  metadata?: Record<string, unknown>
}

export interface SocialPlatformConnector {
  readonly platformId: PlatformId
  readonly displayName: string
  getAuthUrl(state: string, redirectUri: string): string
  exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens>
  refreshTokens(refreshToken: string): Promise<OAuthTokens>
  publish(
    accessToken: string,
    input: PublishInput,
    connection: ConnectionContext,
  ): Promise<PublishResult>
  getAccountInfo?(accessToken: string): Promise<ConnectionContext>
}

export interface PlatformConnectionView {
  id: string
  platformId: string
  accountName: string | null
  status: ConnectionStatus
  tokenExpiresAt: string | null
  externalAccountId: string | null
}

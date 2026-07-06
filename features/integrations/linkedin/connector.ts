import { IntegrationError } from "@/features/integrations/shared/errors"
import type {
  ConnectionContext,
  OAuthTokens,
  PublishInput,
  PublishResult,
  SocialPlatformConnector,
} from "@/features/integrations/types"

export const linkedinConnector: SocialPlatformConnector = {
  platformId: "linkedin",
  displayName: "LinkedIn",

  getAuthUrl(): string {
    throw IntegrationError.notImplemented("linkedin")
  },

  async exchangeCode(): Promise<OAuthTokens> {
    throw IntegrationError.notImplemented("linkedin")
  },

  async refreshTokens(): Promise<OAuthTokens> {
    throw IntegrationError.notImplemented("linkedin")
  },

  async publish(): Promise<PublishResult> {
    throw IntegrationError.notImplemented("linkedin")
  },

  async getAccountInfo(): Promise<ConnectionContext> {
    throw IntegrationError.notImplemented("linkedin")
  },
}

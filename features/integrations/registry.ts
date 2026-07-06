import { facebookConnector } from "@/features/integrations/facebook/connector"
import { instagramConnector } from "@/features/integrations/instagram/connector"
import { linkedinConnector } from "@/features/integrations/linkedin/connector"
import { IntegrationError } from "@/features/integrations/shared/errors"
import type { PlatformId, SocialPlatformConnector } from "@/features/integrations/types"

const connectors = new Map<PlatformId, SocialPlatformConnector>()

export function registerPlatform(connector: SocialPlatformConnector): void {
  connectors.set(connector.platformId, connector)
}

export function getConnector(platformId: string): SocialPlatformConnector {
  const connector = connectors.get(platformId as PlatformId)
  if (!connector) {
    throw IntegrationError.platformNotSupported(platformId)
  }
  return connector
}

export function getAllConnectors(): SocialPlatformConnector[] {
  return Array.from(connectors.values())
}

export function isSupportedPlatform(platformId: string): platformId is PlatformId {
  return connectors.has(platformId as PlatformId)
}

registerPlatform(facebookConnector)
registerPlatform(instagramConnector)
registerPlatform(linkedinConnector)

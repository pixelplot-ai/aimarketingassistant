import { getAppBaseUrl } from "@/features/integrations/facebook/config"

export const LINKEDIN_SCOPES = [
  "openid",
  "profile",
  "email",
  "w_member_social",
] as const

export interface LinkedInAppConfig {
  clientId: string
  clientSecret: string
  apiVersion: string
}

export function getLinkedInAppConfig(): LinkedInAppConfig | null {
  const clientId = process.env.LINKEDIN_CLIENT_ID?.trim() ?? ""
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim() ?? ""

  if (!clientId || !clientSecret) {
    return null
  }

  return {
    clientId,
    clientSecret,
    apiVersion: process.env.LINKEDIN_API_VERSION?.trim() || "202601",
  }
}

export function isLinkedInDevStubMode(): boolean {
  return getLinkedInAppConfig() === null
}

export function getLinkedInOAuthRedirectUri(): string {
  return `${getAppBaseUrl()}/api/auth/callback/linkedin`
}

export function buildLinkedInOAuthUrl(options: {
  state: string
  redirectUri: string
}): string {
  const config = getLinkedInAppConfig()
  if (!config) {
    throw new Error("LinkedIn app credentials are not configured")
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: options.redirectUri,
    state: options.state,
    scope: LINKEDIN_SCOPES.join(" "),
  })

  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
}

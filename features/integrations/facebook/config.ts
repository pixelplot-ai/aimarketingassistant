export interface MetaAppConfig {
  appId: string
  appSecret: string
  graphVersion: string
}

export function getMetaAppConfig(): MetaAppConfig | null {
  const appId =
    process.env.FACEBOOK_APP_ID?.trim() ||
    process.env.META_APP_ID?.trim() ||
    ""
  const appSecret =
    process.env.FACEBOOK_APP_SECRET?.trim() ||
    process.env.META_APP_SECRET?.trim() ||
    ""

  if (!appId || !appSecret) {
    return null
  }

  return {
    appId,
    appSecret,
    graphVersion: process.env.META_GRAPH_VERSION?.trim() || "v21.0",
  }
}

export function isMetaDevStubMode(): boolean {
  if (getMetaAppConfig() !== null) {
    return false
  }

  if (process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim()) {
    return false
  }

  return true
}

export function getAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ?? ""
  const vercelHost = process.env.VERCEL_URL?.trim().replace(/^https?:\/\//, "")

  if (vercelHost) {
    const vercelBase = `https://${vercelHost}`
    if (
      !explicit ||
      explicit.includes("localhost") ||
      explicit.includes("127.0.0.1")
    ) {
      return vercelBase
    }
    return explicit
  }

  return explicit || "http://localhost:3000"
}

/** True when NEXT_PUBLIC_APP_URL points at localhost but the app runs on Vercel. */
export function isAppUrlMisconfiguredForVercel(): boolean {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? ""
  const vercelHost = process.env.VERCEL_URL?.trim()
  if (!vercelHost) {
    return false
  }
  return (
    !explicit ||
    explicit.includes("localhost") ||
    explicit.includes("127.0.0.1")
  )
}

export function getOAuthRedirectUri(platform: string): string {
  return `${getAppBaseUrl()}/api/auth/callback/${platform}`
}

/** Facebook Login for Business configuration ID (from Meta → Configurations). */
export function getMetaLoginConfigId(): string | null {
  const configId =
    process.env.META_FB_LOGIN_CONFIG_ID?.trim() ||
    process.env.META_LOGIN_CONFIG_ID?.trim() ||
    ""

  return configId || null
}

export function buildMetaOAuthUrl(options: {
  state: string
  redirectUri: string
  scope?: string
}): string {
  const config = getMetaAppConfig()
  if (!config) {
    throw new Error("Meta app credentials are not configured")
  }

  const configId = getMetaLoginConfigId()
  const params = new URLSearchParams({
    client_id: config.appId,
    redirect_uri: options.redirectUri,
    state: options.state,
    response_type: "code",
  })

  if (configId) {
    params.set("config_id", configId)
  } else if (options.scope) {
    params.set("scope", options.scope)
  }

  return `https://www.facebook.com/${config.graphVersion}/dialog/oauth?${params.toString()}`
}

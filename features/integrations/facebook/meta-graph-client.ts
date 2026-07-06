import { getMetaAppConfig } from "@/features/integrations/facebook/config"
import { IntegrationError } from "@/features/integrations/shared/errors"

export type GraphRequestOptions = {
  method?: "GET" | "POST" | "DELETE"
  accessToken?: string
  params?: Record<string, string | undefined>
  body?: Record<string, unknown>
}

export type GraphResponse<T = Record<string, unknown>> = T & {
  error?: {
    message: string
    type?: string
    code?: number
    error_subcode?: number
  }
}

function buildUrl(path: string, params?: Record<string, string | undefined>): string {
  const config = getMetaAppConfig()
  const version = config?.graphVersion ?? "v21.0"
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  const url = new URL(`https://graph.facebook.com/${version}${normalizedPath}`)

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, value)
      }
    }
  }

  return url.toString()
}

function toFormBody(params: Record<string, string | undefined>): string {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      body.set(key, value)
    }
  }
  return body.toString()
}

export async function graphRequest<T = Record<string, unknown>>(
  path: string,
  options: GraphRequestOptions = {},
): Promise<T> {
  const method = options.method ?? "GET"
  const params = {
    ...options.params,
    access_token: options.accessToken,
  }

  const filteredParams = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  ) as Record<string, string>

  let url = buildUrl(path)
  let body: string | undefined

  if (method === "GET") {
    url = buildUrl(path, filteredParams)
  } else if (Object.keys(filteredParams).length > 0) {
    body = toFormBody(filteredParams)
  } else if (options.body) {
    body = JSON.stringify(options.body)
  }

  const response = await fetch(url, {
    method,
    headers: body
      ? {
          "Content-Type":
            options.body && !Object.keys(filteredParams).length
              ? "application/json"
              : "application/x-www-form-urlencoded",
        }
      : undefined,
    body,
    cache: "no-store",
  })

  const payload = (await response.json()) as GraphResponse<T>

  if (!response.ok || payload.error) {
    throw new IntegrationError({
      code: "EXTERNAL_SERVICE",
      message: payload.error?.message ?? `Graph API request failed (${response.status})`,
      userMessage: "Meta API request failed. Please try again.",
      cause: payload.error,
    })
  }

  return payload as T
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<{ access_token: string; token_type?: string; expires_in?: number }> {
  const config = getMetaAppConfig()
  if (!config) {
    throw new IntegrationError({
      code: "OAUTH_FAILED",
      message: "Meta app credentials are not configured",
      userMessage: "Facebook/Instagram OAuth is not configured.",
    })
  }

  const url = buildUrl("/oauth/access_token", {
    client_id: config.appId,
    client_secret: config.appSecret,
    redirect_uri: redirectUri,
    code,
  })

  const response = await fetch(url, { cache: "no-store" })
  const payload = (await response.json()) as GraphResponse<{
    access_token: string
    token_type?: string
    expires_in?: number
  }>

  if (!response.ok || payload.error || !payload.access_token) {
    throw new IntegrationError({
      code: "OAUTH_FAILED",
      message: payload.error?.message ?? "Failed to exchange OAuth code",
      userMessage: "Could not complete platform authorization.",
      cause: payload.error,
    })
  }

  return payload
}

export async function exchangeForLongLivedToken(
  shortLivedToken: string,
): Promise<{ access_token: string; expires_in?: number }> {
  const config = getMetaAppConfig()
  if (!config) {
    return { access_token: shortLivedToken }
  }

  const payload = await graphRequest<{ access_token: string; expires_in?: number }>(
    "/oauth/access_token",
    {
      params: {
        grant_type: "fb_exchange_token",
        client_id: config.appId,
        client_secret: config.appSecret,
        fb_exchange_token: shortLivedToken,
      },
    },
  )

  return payload
}

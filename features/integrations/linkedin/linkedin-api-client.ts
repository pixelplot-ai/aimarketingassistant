import { getLinkedInAppConfig } from "@/features/integrations/linkedin/config"
import { IntegrationError } from "@/features/integrations/shared/errors"

type LinkedInTokenResponse = {
  access_token: string
  expires_in?: number
  refresh_token?: string
  refresh_token_expires_in?: number
  scope?: string
  id_token?: string
  error?: string
  error_description?: string
}

export type LinkedInMemberProfile = {
  personId: string
  accountName: string | null
}

export type LinkedInPostPayload = {
  authorUrn: string
  commentary: string
  imageUrn?: string | null
}

function getApiVersion(): string {
  return getLinkedInAppConfig()?.apiVersion ?? "202601"
}

function linkedInApiHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Linkedin-Version": getApiVersion(),
    "X-Restli-Protocol-Version": "2.0.0",
  }
}

function parseJwtPayload(idToken: string): Record<string, unknown> | null {
  try {
    const parts = idToken.split(".")
    if (parts.length < 2) {
      return null
    }

    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=")
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<
      string,
      unknown
    >
  } catch {
    return null
  }
}

async function linkedInFormPost<T>(
  url: string,
  body: Record<string, string>,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  })

  const data = (await response.json()) as T & LinkedInTokenResponse

  if (!response.ok || ("error" in data && data.error)) {
    const message =
      ("error_description" in data && data.error_description) ||
      ("error" in data && data.error) ||
      `LinkedIn token request failed (${response.status})`
    throw new IntegrationError({
      code: "OAUTH_FAILED",
      message: String(message),
      userMessage: "LinkedIn authorization failed. Please try again.",
      platformId: "linkedin",
    })
  }

  return data
}

async function linkedInApiRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT"
    accessToken: string
    body?: unknown
    headers?: Record<string, string>
  },
): Promise<{ data: T; headers: Headers }> {
  const url = path.startsWith("https://")
    ? path
    : `https://api.linkedin.com${path.startsWith("/") ? path : `/${path}`}`

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      ...linkedInApiHeaders(options.accessToken),
      ...(options.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  const text = await response.text()
  let data: T | Record<string, unknown> = {}
  if (text) {
    try {
      data = JSON.parse(text) as T
    } catch {
      data = { raw: text }
    }
  }

  if (!response.ok) {
    const message =
      (data as { message?: string }).message ??
      (data as { status?: number }).status ??
      `LinkedIn API request failed (${response.status})`
    throw new IntegrationError({
      code: "EXTERNAL_SERVICE",
      message: String(message),
      userMessage: "LinkedIn API request failed.",
      platformId: "linkedin",
    })
  }

  return { data: data as T, headers: response.headers }
}

export async function exchangeLinkedInCode(
  code: string,
  redirectUri: string,
): Promise<LinkedInTokenResponse> {
  const config = getLinkedInAppConfig()
  if (!config) {
    throw new IntegrationError({
      code: "OAUTH_FAILED",
      message: "LinkedIn credentials are not configured",
      userMessage: "LinkedIn is not configured on the server.",
      platformId: "linkedin",
    })
  }

  return linkedInFormPost<LinkedInTokenResponse>(
    "https://www.linkedin.com/oauth/v2/accessToken",
    {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    },
  )
}

export async function refreshLinkedInToken(
  refreshToken: string,
): Promise<LinkedInTokenResponse> {
  const config = getLinkedInAppConfig()
  if (!config) {
    throw new IntegrationError({
      code: "OAUTH_FAILED",
      message: "LinkedIn credentials are not configured",
      userMessage: "LinkedIn is not configured on the server.",
      platformId: "linkedin",
    })
  }

  return linkedInFormPost<LinkedInTokenResponse>(
    "https://www.linkedin.com/oauth/v2/accessToken",
    {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    },
  )
}

function profileFromJwt(idToken: string): LinkedInMemberProfile | null {
  const payload = parseJwtPayload(idToken)
  const sub = payload?.sub
  if (typeof sub !== "string" || !sub) {
    return null
  }

  const name =
    typeof payload.name === "string"
      ? payload.name
      : [payload.given_name, payload.family_name]
          .filter((part) => typeof part === "string" && part)
          .join(" ") || null

  return {
    personId: sub,
    accountName: name,
  }
}

async function profileFromUserInfo(
  accessToken: string,
): Promise<LinkedInMemberProfile | null> {
  try {
    const { data } = await linkedInApiRequest<{
      sub?: string
      name?: string
      given_name?: string
      family_name?: string
    }>("/v2/userinfo", { accessToken })

    if (!data.sub) {
      return null
    }

    const accountName =
      data.name ??
      ([data.given_name, data.family_name].filter(Boolean).join(" ") || null)

    return {
      personId: data.sub,
      accountName,
    }
  } catch {
    return null
  }
}

async function profileFromMe(
  accessToken: string,
): Promise<LinkedInMemberProfile | null> {
  try {
    const { data } = await linkedInApiRequest<{
      id?: string
      localizedFirstName?: string
      localizedLastName?: string
      vanityName?: string
    }>("/v2/me?projection=(id,localizedFirstName,localizedLastName,vanityName)", {
      accessToken,
    })

    if (!data.id) {
      return null
    }

    const fullName = [data.localizedFirstName, data.localizedLastName]
      .filter(Boolean)
      .join(" ")

    return {
      personId: data.id,
      accountName: fullName || data.vanityName || null,
    }
  } catch {
    return null
  }
}

export async function resolveLinkedInMemberProfile(options: {
  accessToken: string
  idToken?: string | null
}): Promise<LinkedInMemberProfile> {
  if (options.idToken) {
    const fromJwt = profileFromJwt(options.idToken)
    if (fromJwt) {
      return fromJwt
    }
  }

  const fromUserInfo = await profileFromUserInfo(options.accessToken)
  if (fromUserInfo) {
    return fromUserInfo
  }

  const fromMe = await profileFromMe(options.accessToken)
  if (fromMe) {
    return fromMe
  }

  throw new IntegrationError({
    code: "OAUTH_FAILED",
    message: "Could not resolve LinkedIn member profile",
    userMessage: "LinkedIn did not return account details. Please try again.",
    platformId: "linkedin",
  })
}

export async function uploadLinkedInImageFromUrl(
  accessToken: string,
  authorUrn: string,
  imageUrl: string,
): Promise<string> {
  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) {
    throw new IntegrationError({
      code: "PUBLISH_FAILED",
      message: `Failed to fetch image (${imageResponse.status})`,
      userMessage: "Could not load the image for LinkedIn upload.",
      platformId: "linkedin",
    })
  }

  const imageBytes = Buffer.from(await imageResponse.arrayBuffer())
  const contentType =
    imageResponse.headers.get("content-type") ?? "application/octet-stream"

  const { data } = await linkedInApiRequest<{
    value?: {
      uploadUrl?: string
      image?: string
    }
  }>("/rest/images?action=initializeUpload", {
    method: "POST",
    accessToken,
    body: {
      initializeUploadRequest: {
        owner: authorUrn,
      },
    },
  })

  const uploadUrl = data.value?.uploadUrl
  const imageUrn = data.value?.image

  if (!uploadUrl || !imageUrn) {
    throw new IntegrationError({
      code: "PUBLISH_FAILED",
      message: "LinkedIn image initializeUpload did not return upload URL",
      userMessage: "LinkedIn image upload failed to initialize.",
      platformId: "linkedin",
    })
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": contentType,
    },
    body: imageBytes,
  })

  if (!uploadResponse.ok) {
    throw new IntegrationError({
      code: "PUBLISH_FAILED",
      message: `LinkedIn image upload failed (${uploadResponse.status})`,
      userMessage: "Failed to upload image to LinkedIn.",
      platformId: "linkedin",
    })
  }

  return imageUrn
}

export async function createLinkedInPost(
  accessToken: string,
  payload: LinkedInPostPayload,
): Promise<{ postId: string; responseBody: Record<string, unknown> }> {
  const body: Record<string, unknown> = {
    author: payload.authorUrn,
    commentary: payload.commentary,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  }

  if (payload.imageUrn) {
    body.content = {
      media: {
        id: payload.imageUrn,
      },
    }
  }

  const { data, headers } = await linkedInApiRequest<Record<string, unknown>>(
    "/rest/posts",
    {
      method: "POST",
      accessToken,
      body,
    },
  )

  const postId =
    headers.get("x-restli-id") ??
    headers.get("X-RestLi-Id") ??
    (typeof data.id === "string" ? data.id : undefined)

  if (!postId) {
    throw new IntegrationError({
      code: "PUBLISH_FAILED",
      message: "LinkedIn post created but no post ID returned",
      userMessage: "LinkedIn publish succeeded but no post ID was returned.",
      platformId: "linkedin",
    })
  }

  return { postId, responseBody: data }
}

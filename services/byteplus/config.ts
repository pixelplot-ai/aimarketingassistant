/**
 * BytePlus ModelArk environment configuration.
 * Read lazily so the app still builds when BytePlus is not configured yet.
 */

const DEFAULT_ARK_BASE_URL = "https://ark.ap-southeast.bytepluses.com/api/v3"

export function getByteplusArkApiKey(): string {
  const key = process.env.BYTEPLUS_ARK_API_KEY?.trim()
  if (!key) {
    throw new Error(
      "BYTEPLUS_ARK_API_KEY is not configured. Add it to your environment to enable Seedance.",
    )
  }
  return key
}

export function getByteplusArkBaseUrl(): string {
  const configured = process.env.BYTEPLUS_ARK_BASE_URL?.trim()
  if (!configured) return DEFAULT_ARK_BASE_URL
  return configured.replace(/\/+$/, "")
}

export function getSeedanceModelId(): string {
  const model = process.env.SEEDANCE_MODEL_ID?.trim()
  if (!model) {
    throw new Error(
      "SEEDANCE_MODEL_ID is not configured. Copy the model or endpoint ID from the ModelArk console.",
    )
  }
  return normalizeArkModelId(model)
}

export function getSeedanceFastModelId(): string {
  const model = process.env.SEEDANCE_FAST_MODEL_ID?.trim()
  if (!model) {
    throw new Error(
      "SEEDANCE_FAST_MODEL_ID is not configured. Copy the Fast model or endpoint ID from the ModelArk console.",
    )
  }
  return normalizeArkModelId(model)
}

export function getSeedance25ModelId(): string {
  const model = process.env.SEEDANCE_2_5_MODEL_ID?.trim()
  if (!model) {
    throw new Error(
      "SEEDANCE_2_5_MODEL_ID is not configured. Copy the Seedance 2.5 model or endpoint ID from the ModelArk console.",
    )
  }
  return normalizeArkModelId(model)
}

export function resolveSeedanceModelId(
  optionId: "seedance_2_5" | "seedance_2_0" | "seedance_2_0_fast",
): string {
  if (optionId === "seedance_2_0_fast") return getSeedanceFastModelId()
  if (optionId === "seedance_2_5") return getSeedance25ModelId()
  return getSeedanceModelId()
}

/**
 * Foundation model ids are hyphenated (`2-0-260128`). The console copy button
 * sometimes yields a display id with a version dot (`2.0-260128`).
 * Endpoint ids (`ep-…`) are left unchanged.
 */
export function normalizeArkModelId(model: string): string {
  if (model.startsWith("ep-")) return model
  return model.replace(/(\d)\.(\d)/g, "$1-$2")
}

export function getSeedanceWebhookUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "")
  if (!base) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is not configured. Set it to your Vercel production origin.",
    )
  }
  return `${base}/api/webhooks/byteplus`
}

export function getVisualValidateWebhookUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "")
  if (!base) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is not configured. Set it to your Vercel production origin.",
    )
  }
  return `${base}/api/webhooks/visual-validate`
}

export function getArkProjectName(): string {
  return process.env.BYTEPLUS_ARK_PROJECT_NAME?.trim() || "default"
}

/** OpenAPI gateway for Administration / private asset library Action APIs. */
const DEFAULT_ARK_OPENAPI_HOST = "ark.ap-southeast-1.byteplusapi.com"
const DEFAULT_ARK_OPENAPI_REGION = "ap-southeast-1"

export function getByteplusArkOpenApiHost(): string {
  const configured = process.env.BYTEPLUS_ARK_OPENAPI_HOST?.trim()
  if (configured) return configured.replace(/^https?:\/\//, "").replace(/\/+$/, "")
  return DEFAULT_ARK_OPENAPI_HOST
}

export function getByteplusArkOpenApiRegion(): string {
  return (
    process.env.BYTEPLUS_ARK_OPENAPI_REGION?.trim() || DEFAULT_ARK_OPENAPI_REGION
  )
}

/**
 * IAM Access Key for ModelArk Administration APIs (CreateVisualValidateSession, etc.).
 * Not the same as BYTEPLUS_ARK_API_KEY (Bearer key for Seedance inference).
 */
export function getByteplusAccessKeyId(): string {
  const key =
    process.env.BYTEPLUS_ACCESS_KEY_ID?.trim() ||
    process.env.BYTEPLUS_ACCESSKEY?.trim()
  if (!key) {
    throw new Error(
      "BYTEPLUS_ACCESS_KEY_ID is not configured. Private asset / real-human APIs need IAM AK/SK (BytePlus Console → IAM → Key Management), not the ModelArk API key.",
    )
  }
  return key
}

export function getByteplusSecretAccessKey(): string {
  const key =
    process.env.BYTEPLUS_SECRET_ACCESS_KEY?.trim() ||
    process.env.BYTEPLUS_SECRETKEY?.trim()
  if (!key) {
    throw new Error(
      "BYTEPLUS_SECRET_ACCESS_KEY is not configured. Private asset / real-human APIs need IAM AK/SK (BytePlus Console → IAM → Key Management).",
    )
  }
  return key
}

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

export function resolveSeedanceModelId(optionId: "seedance_2_0" | "seedance_2_0_fast"): string {
  if (optionId === "seedance_2_0_fast") return getSeedanceFastModelId()
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

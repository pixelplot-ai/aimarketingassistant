/**
 * Gemini Interactions webhook signatures.
 *
 * Live deliveries follow Standard Webhooks: `webhook-signature` is
 * `v1a,<Ed25519 signature>` over `${webhook-id}.${webhook-timestamp}.${rawBody}`.
 * Google's JWKS publishes OKP keys with no `kid`, so each key is tried.
 * An RS256 JWT in the same header is still accepted.
 */

import { createPublicKey, createVerify, verify, type JsonWebKey } from "node:crypto"

const JWKS_URL = "https://generativelanguage.googleapis.com/.well-known/jwks.json"
const KEY_TTL_MS = 60 * 60 * 1000
const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60

export class GeminiWebhookVerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "GeminiWebhookVerificationError"
  }
}

interface JwkRecord extends JsonWebKey {
  kid?: string
}

interface SignaturePart {
  scheme: string
  value: string
}

export interface GeminiWebhookRequest {
  signature: string | null
  id: string | null
  timestamp: string | null
  rawBody: string
}

let cachedKeys: { keys: JwkRecord[]; fetchedAt: number } | null = null

function decodeJson<T>(segment: string): T {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T
  } catch {
    throw new GeminiWebhookVerificationError("Webhook signature is not a JWT")
  }
}

function isEd25519(jwk: JwkRecord): boolean {
  return jwk.kty === "OKP" && jwk.crv === "Ed25519" && Boolean(jwk.x)
}

async function loadKeys(force: boolean): Promise<JwkRecord[]> {
  const fresh = cachedKeys && Date.now() - cachedKeys.fetchedAt < KEY_TTL_MS
  if (cachedKeys && fresh && !force) return cachedKeys.keys

  let response: Response
  try {
    response = await fetch(JWKS_URL)
  } catch (err) {
    throw Object.assign(
      new GeminiWebhookVerificationError("Webhook verification unavailable"),
      { cause: err },
    )
  }
  if (!response.ok) {
    throw new GeminiWebhookVerificationError("Webhook verification unavailable")
  }
  const body = (await response.json()) as { keys?: JwkRecord[] }
  const keys = body.keys ?? []
  cachedKeys = { keys, fetchedAt: Date.now() }
  return keys
}

function readSignatureParts(header: string | null): SignaturePart[] {
  const token = header?.trim() ?? ""
  if (!token) {
    throw new GeminiWebhookVerificationError("Missing webhook-signature header")
  }
  return token.split(/\s+/).map((part) => {
    const comma = part.indexOf(",")
    if (comma === -1) return { scheme: "jwt", value: part }
    return {
      scheme: part.slice(0, comma).trim(),
      value: part.slice(comma + 1).trim(),
    }
  })
}

function assertFreshTimestamp(header: string | null): string {
  const timestamp = header?.trim() ?? ""
  const numeric = Number(timestamp)
  if (!timestamp || !Number.isFinite(numeric)) {
    throw new GeminiWebhookVerificationError("Missing webhook-timestamp header")
  }
  const seconds = numeric > 1e12 ? numeric / 1000 : numeric
  if (Math.abs(Date.now() / 1000 - seconds) > TIMESTAMP_TOLERANCE_SECONDS) {
    throw new GeminiWebhookVerificationError("Webhook signature expired")
  }
  return timestamp
}

function jwtKid(token: string): string {
  const header = token.split(".")[0]
  if (!header) {
    throw new GeminiWebhookVerificationError("Webhook signature is not a JWT")
  }
  const decoded = decodeJson<{ kid?: string }>(header)
  if (!decoded.kid) {
    throw new GeminiWebhookVerificationError("Webhook signature is missing a key id")
  }
  return decoded.kid
}

function verifyGeminiRs256(token: string, jwk: JwkRecord): void {
  const parts = token.trim().split(".")
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new GeminiWebhookVerificationError("Webhook signature is not a JWT")
  }

  const header = decodeJson<{ alg?: string }>(parts[0])
  if (header.alg !== "RS256") {
    throw new GeminiWebhookVerificationError("Unexpected webhook signature algorithm")
  }

  const key = createPublicKey({ key: jwk, format: "jwk" })
  const verifier = createVerify("RSA-SHA256")
  verifier.update(`${parts[0]}.${parts[1]}`)
  const valid = verifier.verify(key, parts[2], "base64url")
  if (!valid) {
    throw new GeminiWebhookVerificationError("Webhook signature mismatch")
  }

  const payload = decodeJson<{ exp?: number; nbf?: number }>(parts[1])
  const now = Math.floor(Date.now() / 1000)
  if (typeof payload.exp === "number" && payload.exp < now) {
    throw new GeminiWebhookVerificationError("Webhook signature expired")
  }
  if (typeof payload.nbf === "number" && payload.nbf > now + 60) {
    throw new GeminiWebhookVerificationError("Webhook signature is not valid yet")
  }
}

function verifyGeminiEd25519(
  signature: string,
  jwk: JwkRecord,
  message: string,
): void {
  let key
  try {
    key = createPublicKey({ key: jwk, format: "jwk" })
  } catch {
    throw new GeminiWebhookVerificationError("Webhook signature mismatch")
  }

  const payload = Buffer.from(message)
  for (const encoding of ["base64", "base64url"] as const) {
    const bytes = Buffer.from(signature, encoding)
    if (!bytes.length) continue
    try {
      if (verify(null, payload, key, bytes)) return
    } catch {
      // Wrong signature length for this encoding. Try the other one.
    }
  }
  throw new GeminiWebhookVerificationError("Webhook signature mismatch")
}

async function verifyJwt(token: string): Promise<void> {
  const kid = jwtKid(token)
  let keys = await loadKeys(false)
  let jwk = keys.find((key) => key.kid === kid)
  if (!jwk) {
    keys = await loadKeys(true)
    jwk = keys.find((key) => key.kid === kid)
  }
  if (!jwk) {
    throw new GeminiWebhookVerificationError("Webhook signing key was not found")
  }
  verifyGeminiRs256(token, jwk)
}

function matchesEd25519(
  signatures: string[],
  keys: JwkRecord[],
  message: string,
): boolean {
  for (const signature of signatures) {
    for (const jwk of keys) {
      try {
        verifyGeminiEd25519(signature, jwk, message)
        return true
      } catch (error) {
        if (!(error instanceof GeminiWebhookVerificationError)) throw error
      }
    }
  }
  return false
}

export async function verifyGeminiWebhook(
  input: GeminiWebhookRequest,
): Promise<void> {
  const parts = readSignatureParts(input.signature)
  const v1a = parts
    .filter((part) => part.scheme === "v1a" && part.value)
    .map((part) => part.value)
  if (v1a.length > 0) {
    const timestamp = assertFreshTimestamp(input.timestamp)
    const id = input.id?.trim() ?? ""
    if (!id) {
      throw new GeminiWebhookVerificationError("Missing webhook-id header")
    }
    const message = `${id}.${timestamp}.${input.rawBody}`
    let keys = (await loadKeys(false)).filter(isEd25519)
    if (!matchesEd25519(v1a, keys, message)) {
      keys = (await loadKeys(true)).filter(isEd25519)
      if (!matchesEd25519(v1a, keys, message)) {
        throw new GeminiWebhookVerificationError(
          keys.length === 0
            ? "Webhook signing key was not found"
            : "Webhook signature mismatch",
        )
      }
    }
    return
  }

  const jwt = parts.find(
    (part) => (part.scheme === "jwt" || part.scheme === "v1") && part.value,
  )
  if (!jwt) {
    throw new GeminiWebhookVerificationError("Webhook signature is not a JWT")
  }
  await verifyJwt(jwt.value)
}

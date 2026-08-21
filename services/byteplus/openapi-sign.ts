/**
 * BytePlus OpenAPI request signing (HMAC-SHA256).
 * Used for ModelArk Administration / private asset library Action APIs.
 * @see https://docs.byteplus.com/en/docs/byteplus-platform/reference-how-to-calculate-a-signature
 */

import { createHash, createHmac } from "node:crypto"

function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex")
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest()
}

function uriEscape(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

function canonicalQuery(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((key) => `${uriEscape(key)}=${uriEscape(params[key])}`)
    .join("&")
}

export interface SignedOpenApiRequest {
  url: string
  headers: Record<string, string>
  body: string
}

export function signByteplusOpenApiRequest(input: {
  accessKeyId: string
  secretAccessKey: string
  region: string
  service: string
  host: string
  method: "POST" | "GET"
  action: string
  version: string
  body: Record<string, unknown>
}): SignedOpenApiRequest {
  const method = input.method
  const pathname = "/"
  const query = {
    Action: input.action,
    Version: input.version,
  }
  const body = JSON.stringify(input.body)
  const payloadHash = sha256Hex(body)

  const now = new Date()
  const xDate = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
  const shortDate = xDate.slice(0, 8)

  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    host: input.host,
    "x-content-sha256": payloadHash,
    "x-date": xDate,
  }

  const signedHeaderNames = Object.keys(headers)
    .map((name) => name.toLowerCase())
    .sort()
  const signedHeaders = signedHeaderNames.join(";")
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${headers[name].trim()}\n`)
    .join("")

  const canonicalRequest = [
    method,
    pathname,
    canonicalQuery(query),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n")

  const credentialScope = `${shortDate}/${input.region}/${input.service}/request`
  const stringToSign = [
    "HMAC-SHA256",
    xDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n")

  const kDate = hmac(input.secretAccessKey, shortDate)
  const kRegion = hmac(kDate, input.region)
  const kService = hmac(kRegion, input.service)
  const kSigning = hmac(kService, "request")
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign, "utf8")
    .digest("hex")

  headers.authorization = `HMAC-SHA256 Credential=${input.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const url = `https://${input.host}${pathname}?${canonicalQuery(query)}`
  return { url, headers, body }
}

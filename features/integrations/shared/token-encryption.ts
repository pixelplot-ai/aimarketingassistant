import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"

import { IntegrationError } from "@/features/integrations/shared/errors"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY

  if (!raw) {
    throw new IntegrationError({
      code: "INTERNAL",
      message: "TOKEN_ENCRYPTION_KEY is not configured",
      userMessage: "Token encryption is not configured on the server.",
    })
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex")
  }

  const decoded = Buffer.from(raw, "base64")
  if (decoded.length === 32) {
    return decoded
  }

  return createHash("sha256").update(raw).digest()
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return Buffer.concat([iv, authTag, encrypted]).toString("base64")
}

export function decryptToken(ciphertext: string): string {
  const key = getEncryptionKey()
  const buffer = Buffer.from(ciphertext, "base64")

  if (buffer.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new IntegrationError({
      code: "INTERNAL",
      message: "Invalid encrypted token payload",
      userMessage: "Stored connection token is invalid.",
    })
  }

  const iv = buffer.subarray(0, IV_LENGTH)
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ])

  return decrypted.toString("utf8")
}

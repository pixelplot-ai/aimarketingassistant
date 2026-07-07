import { AppError } from "@/lib/errors/app-error"
import {
  BUCKET_CONFIG,
  type StorageBucket,
} from "@/services/storage/constants"
import { createAdminClient } from "@/services/supabase/admin"
import { createClient } from "@/services/supabase/server"

export type { StorageBucket, BucketConfig } from "@/services/storage/constants"
export { BUCKET_CONFIG } from "@/services/storage/constants"

export type FileValidationResult =
  | { valid: true }
  | { valid: false; error: string }

export function validateFile(
  file: File,
  bucket: StorageBucket,
): FileValidationResult {
  if (!file || file.size === 0) {
    return { valid: false, error: "No file provided." }
  }

  const config = BUCKET_CONFIG[bucket]

  if (file.size > config.maxBytes) {
    const maxMb = Math.round(config.maxBytes / (1024 * 1024))
    return {
      valid: false,
      error: `File is too large. Maximum size is ${maxMb} MB.`,
    }
  }

  if (!config.acceptedTypes.includes(file.type)) {
    return { valid: false, error: "Unsupported file type." }
  }

  return { valid: true }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, "_")
}

export type UploadResult = {
  storagePath: string
  mimeType: string
  fileSize: number
  fileName: string
}

export async function uploadToBucket(
  userId: string,
  bucket: StorageBucket,
  file: File,
): Promise<UploadResult> {
  const validation = validateFile(file, bucket)

  if (!validation.valid) {
    throw new AppError({
      code: "VALIDATION",
      message: validation.error,
      userMessage: validation.error,
    })
  }

  const supabase = await createClient()
  const storagePath = `${userId}/${Date.now()}-${sanitizeFileName(file.name)}`

  const { error } = await supabase.storage.from(bucket).upload(storagePath, file, {
    upsert: false,
    contentType: file.type,
  })

  if (error) {
    throw new AppError({
      code: "INTERNAL",
      message: error.message,
      userMessage: "Failed to upload file.",
    })
  }

  return {
    storagePath,
    mimeType: file.type,
    fileSize: file.size,
    fileName: file.name,
  }
}

export async function createSignedUrl(
  bucket: StorageBucket | "logos" | "brand-assets",
  storagePath: string,
  expiresInSeconds = 60 * 60,
): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, expiresInSeconds)

  if (error || !data?.signedUrl) {
    return null
  }

  return data.signedUrl
}

/** Uses the service-role client to sign a URL — bypasses RLS, safe for server-only use. */
export async function createAdminSignedUrl(
  bucket: StorageBucket | "logos" | "brand-assets",
  storagePath: string,
  expiresInSeconds = 60 * 60,
): Promise<string | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, expiresInSeconds)

  if (error || !data?.signedUrl) {
    console.error("[storage] createAdminSignedUrl failed:", error?.message, "path:", storagePath)
    return null
  }

  return data.signedUrl
}

export async function copyStorageFile(
  userId: string,
  bucket: StorageBucket,
  sourcePath: string,
): Promise<{ storagePath: string }> {
  const supabase = await createClient()
  const baseName = sourcePath.split("/").pop() ?? "media"
  const storagePath = `${userId}/${Date.now()}-copy-${sanitizeFileName(baseName)}`

  const { error } = await supabase.storage
    .from(bucket)
    .copy(sourcePath, storagePath)

  if (error) {
    throw new AppError({
      code: "INTERNAL",
      message: error.message,
      userMessage: "Failed to copy media file.",
    })
  }

  return { storagePath }
}

export async function removeFromBucket(
  bucket: StorageBucket,
  storagePath: string,
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.storage.from(bucket).remove([storagePath])

  if (error) {
    throw new AppError({
      code: "INTERNAL",
      message: error.message,
      userMessage: "Failed to remove file from storage.",
    })
  }
}

export function bucketForMediaType(
  mediaType: "uploaded_image" | "generated_image" | "uploaded_video",
): StorageBucket {
  if (mediaType === "uploaded_video") {
    return "videos"
  }

  if (mediaType === "generated_image") {
    return "generated-images"
  }

  return "images"
}

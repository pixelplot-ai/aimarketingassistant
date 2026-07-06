"use server"

import { revalidatePath } from "next/cache"

import { AppError } from "@/lib/errors/app-error"
import { getWorkspaceUserId } from "@/lib/auth/workspace"
import { logAiGeneration } from "@/services/ai/guards"
import { generateImage } from "@/services/ai/gemini"
import type { ImageAspectRatio } from "@/services/ai/types"
import {
  bucketForMediaType,
  createSignedUrl,
  removeFromBucket,
  uploadToBucket,
} from "@/services/storage/upload"
import { createClient } from "@/services/supabase/server"
import type { ActionResult, BrandProfileRow, SettingsBundle } from "@/types/app"
import type { Enums, Tables } from "@/types/database"

export type PostMediaWithUrl = Tables<"post_media"> & {
  signedUrl: string | null
}

async function getAuthenticatedUserId(): Promise<string> {
  return getWorkspaceUserId()
}

async function loadBrandProfile(
  userId: string,
): Promise<BrandProfileRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("brand_profiles")
    .select("*")
    .eq("user_id", userId)
    .eq("is_default", true)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw new AppError({
      code: "INTERNAL",
      message: error.message,
      userMessage: "Failed to load brand profile.",
    })
  }

  return data
}

async function loadSettings(userId: string): Promise<SettingsBundle> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  if (error || !data) {
    throw new AppError({
      code: "INTERNAL",
      message: error?.message ?? "Settings not found",
      userMessage: "Failed to load settings.",
    })
  }

  return data
}

async function loadPostContent(userId: string, postId: string): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("posts")
    .select("content")
    .eq("id", postId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw new AppError({
      code: "INTERNAL",
      message: error.message,
      userMessage: "Failed to load post content.",
    })
  }

  if (!data) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Post not found",
      userMessage: "Post not found.",
    })
  }

  return data.content ?? ""
}

async function assertPostOwnership(
  userId: string,
  postId: string,
): Promise<void> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("posts")
    .select("id")
    .eq("id", postId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw new AppError({
      code: "INTERNAL",
      message: error.message,
      userMessage: "Failed to verify post.",
    })
  }

  if (!data) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Post not found",
      userMessage: "Post not found.",
    })
  }
}

async function getExistingPostMedia(
  postId: string,
): Promise<Tables<"post_media"> | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("post_media")
    .select("*")
    .eq("post_id", postId)
    .maybeSingle()

  if (error) {
    throw new AppError({
      code: "INTERNAL",
      message: error.message,
      userMessage: "Failed to load post media.",
    })
  }

  return data
}

async function removeExistingPostMedia(postId: string): Promise<void> {
  const existing = await getExistingPostMedia(postId)

  if (!existing) {
    return
  }

  const bucket = bucketForMediaType(existing.media_type)

  try {
    await removeFromBucket(bucket, existing.storage_path)
  } catch (error) {
    console.error("[post_media] Storage cleanup failed:", error)
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("post_media")
    .delete()
    .eq("id", existing.id)

  if (error) {
    throw new AppError({
      code: "INTERNAL",
      message: error.message,
      userMessage: "Failed to remove existing media.",
    })
  }
}

async function updatePostMediaType(
  postId: string,
  mediaType: Enums<"media_type">,
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("posts")
    .update({
      media_type: mediaType,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId)

  if (error) {
    throw new AppError({
      code: "INTERNAL",
      message: error.message,
      userMessage: "Failed to update post media type.",
    })
  }
}

function toActionError(error: unknown): ActionResult<never> {
  if (AppError.isAppError(error)) {
    return { success: false, error: error.userMessage }
  }

  if (error instanceof Error) {
    return { success: false, error: error.message }
  }

  return { success: false, error: "Something went wrong. Please try again." }
}

function revalidatePostPaths(postId: string): void {
  revalidatePath("/posts")
  revalidatePath(`/posts/${postId}/edit`)
}

export async function getPostMedia(
  postId: string,
): Promise<ActionResult<PostMediaWithUrl | null>> {
  try {
    const userId = await getAuthenticatedUserId()
    await assertPostOwnership(userId, postId)

    const media = await getExistingPostMedia(postId)

    if (!media) {
      return { success: true, data: null }
    }

    const bucket = bucketForMediaType(media.media_type)
    const signedUrl = await createSignedUrl(bucket, media.storage_path)

    return {
      success: true,
      data: { ...media, signedUrl },
    }
  } catch (error) {
    return toActionError(error)
  }
}

export async function uploadPostImage(
  postId: string,
  formData: FormData,
): Promise<ActionResult<PostMediaWithUrl>> {
  try {
    const userId = await getAuthenticatedUserId()
    await assertPostOwnership(userId, postId)

    const file = formData.get("file")
    if (!(file instanceof File)) {
      return { success: false, error: "No file provided." }
    }

    await removeExistingPostMedia(postId)

    const uploaded = await uploadToBucket(userId, "images", file)

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("post_media")
      .insert({
        post_id: postId,
        media_type: "uploaded_image",
        storage_path: uploaded.storagePath,
        mime_type: uploaded.mimeType,
        file_size: uploaded.fileSize,
        metadata: { file_name: uploaded.fileName },
      })
      .select("*")
      .single()

    if (error || !data) {
      throw new AppError({
        code: "INTERNAL",
        message: error?.message ?? "Insert failed",
        userMessage: "Failed to save image record.",
      })
    }

    await updatePostMediaType(postId, "image")
    revalidatePostPaths(postId)

    const signedUrl = await createSignedUrl("images", uploaded.storagePath)

    return {
      success: true,
      data: { ...data, signedUrl },
    }
  } catch (error) {
    return toActionError(error)
  }
}

export async function uploadPostVideo(
  postId: string,
  formData: FormData,
): Promise<ActionResult<PostMediaWithUrl>> {
  try {
    const userId = await getAuthenticatedUserId()
    await assertPostOwnership(userId, postId)

    const file = formData.get("file")
    if (!(file instanceof File)) {
      return { success: false, error: "No file provided." }
    }

    await removeExistingPostMedia(postId)

    const uploaded = await uploadToBucket(userId, "videos", file)

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("post_media")
      .insert({
        post_id: postId,
        media_type: "uploaded_video",
        storage_path: uploaded.storagePath,
        mime_type: uploaded.mimeType,
        file_size: uploaded.fileSize,
        metadata: { file_name: uploaded.fileName },
      })
      .select("*")
      .single()

    if (error || !data) {
      throw new AppError({
        code: "INTERNAL",
        message: error?.message ?? "Insert failed",
        userMessage: "Failed to save video record.",
      })
    }

    await updatePostMediaType(postId, "video")
    revalidatePostPaths(postId)

    const signedUrl = await createSignedUrl("videos", uploaded.storagePath)

    return {
      success: true,
      data: { ...data, signedUrl },
    }
  } catch (error) {
    return toActionError(error)
  }
}

export async function generatePostImage(input: {
  postId: string
  prompt?: string
  postContent?: string
  aspectRatio: ImageAspectRatio
  productContext?: { name: string; description?: string | null } | null
  productImageStoragePath?: string | null
}): Promise<ActionResult<PostMediaWithUrl>> {
  try {
    const userId = await getAuthenticatedUserId()
    await assertPostOwnership(userId, input.postId)

    const [brandProfile, settings, savedPostContent] = await Promise.all([
      loadBrandProfile(userId),
      loadSettings(userId),
      loadPostContent(userId, input.postId),
    ])

    const postContent = input.postContent?.trim() ?? savedPostContent.trim()
    const prompt = input.prompt?.trim() ?? ""

    if (!postContent && !prompt) {
      throw new AppError({
        code: "VALIDATION",
        message: "Post content and image prompt are empty",
        userMessage:
          "Add post content or an additional image direction before generating.",
      })
    }

    let productImageBytes: { data: Buffer; mimeType: string } | null = null

    console.log("[post-image] product reference input", {
      postId: input.postId,
      productName: input.productContext?.name ?? null,
      productDescription: input.productContext?.description ?? null,
      storagePath: input.productImageStoragePath ?? null,
    })

    if (input.productImageStoragePath) {
      try {
        const supabase = await createClient()
        const { data, error } = await supabase.storage
          .from("product-images")
          .download(input.productImageStoragePath)

        if (!error && data) {
          const arrayBuffer = await data.arrayBuffer()
          productImageBytes = {
            data: Buffer.from(arrayBuffer),
            mimeType: data.type || "image/jpeg",
          }
          console.log("[post-image] product reference image loaded for Gemini", {
            postId: input.postId,
            productName: input.productContext?.name ?? null,
            storagePath: input.productImageStoragePath,
            mimeType: productImageBytes.mimeType,
            byteSize: productImageBytes.data.length,
          })
        } else {
          console.warn("[post-image] product reference image download failed", {
            postId: input.postId,
            productName: input.productContext?.name ?? null,
            storagePath: input.productImageStoragePath,
            error: error?.message ?? "empty response",
          })
        }
      } catch (err) {
        console.warn("[post-image] product reference image download error", {
          postId: input.postId,
          productName: input.productContext?.name ?? null,
          storagePath: input.productImageStoragePath,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    } else {
      console.log("[post-image] no product reference image path — text-only product context", {
        postId: input.postId,
        productName: input.productContext?.name ?? null,
      })
    }

    await removeExistingPostMedia(input.postId)

    const generated = await generateImage({
      prompt,
      postContent,
      aspectRatio: input.aspectRatio,
      brandProfile,
      settings,
      userId,
      productContext: input.productContext,
      productImageBytes,
    })

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("post_media")
      .insert({
        post_id: input.postId,
        media_type: "generated_image",
        storage_path: generated.storagePath,
        mime_type: generated.mimeType,
        file_size: generated.fileSize,
        width: generated.width,
        height: generated.height,
        metadata: {
          prompt: prompt || null,
          post_content_used: postContent.slice(0, 500),
          aspect_ratio: input.aspectRatio,
        },
      })
      .select("*")
      .single()

    if (error || !data) {
      throw new AppError({
        code: "INTERNAL",
        message: error?.message ?? "Insert failed",
        userMessage: "Failed to save generated image record.",
      })
    }

    await updatePostMediaType(input.postId, "image")

    await logAiGeneration({
      operation: "generate_image",
      provider: "gemini",
      brandProfileId: brandProfile?.id ?? null,
      postId: input.postId,
      promptSummary: `Image: ${input.aspectRatio}`,
      metadata: {
        aspect_ratio: input.aspectRatio,
        prompt: prompt.slice(0, 200) || null,
        post_content_used: postContent.slice(0, 200) || null,
      },
    })

    revalidatePostPaths(input.postId)

    const signedUrl = await createSignedUrl(
      "generated-images",
      generated.storagePath,
    )

    return {
      success: true,
      data: { ...data, signedUrl },
    }
  } catch (error) {
    return toActionError(error)
  }
}

export async function removePostMedia(
  postId: string,
): Promise<ActionResult<void>> {
  try {
    const userId = await getAuthenticatedUserId()
    await assertPostOwnership(userId, postId)

    await removeExistingPostMedia(postId)
    await updatePostMediaType(postId, "none")
    revalidatePostPaths(postId)

    return { success: true, data: undefined }
  } catch (error) {
    return toActionError(error)
  }
}

export async function getPostMediaDownloadUrl(
  postId: string,
): Promise<ActionResult<{ url: string; fileName: string }>> {
  try {
    const userId = await getAuthenticatedUserId()
    await assertPostOwnership(userId, postId)

    const media = await getExistingPostMedia(postId)

    if (!media) {
      return { success: false, error: "No media attached to this post." }
    }

    const bucket = bucketForMediaType(media.media_type)
    const signedUrl = await createSignedUrl(bucket, media.storage_path, 60 * 5)

    if (!signedUrl) {
      return { success: false, error: "Failed to create download link." }
    }

    const metadata = media.metadata as { file_name?: string } | null
    const extension = media.mime_type.split("/")[1] ?? "bin"
    const fileName = metadata?.file_name ?? `post-media.${extension}`

    return {
      success: true,
      data: { url: signedUrl, fileName },
    }
  } catch (error) {
    return toActionError(error)
  }
}

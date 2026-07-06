"use server"

import { revalidatePath } from "next/cache"

import sharp from "sharp"
import OpenAI from "openai"

import { getWorkspaceUserId } from "@/lib/auth/workspace"
import { createAdminSignedUrl } from "@/services/storage/upload"
import { AppError } from "@/lib/errors/app-error"
import {
  productFormSchema,
  type ProductFormValues,
  type ProductType,
} from "@/lib/validations/product"
import { getGeminiClient } from "@/services/ai/gemini-client"
import {
  formatGeminiApiError,
  resolveGeminiTextModel,
  DEFAULT_GEMINI_TEXT_MODEL,
} from "@/services/ai/gemini-models"
import { resolveTextProvider } from "@/services/ai/text"
import { createAdminClient } from "@/services/supabase/admin"
import { createClient } from "@/services/supabase/server"
import type { ActionResult, SettingsBundle } from "@/types/app"
import type { Tables } from "@/types/database"

export type ProductRow = Tables<"products">

const PRODUCTS_PATH = "/products"

async function getAuthUserId(): Promise<string> {
  return getWorkspaceUserId()
}

type AiExtractionResult = {
  name: string
  description: string
  image_url: string | null
}

async function loadSettings(userId: string): Promise<SettingsBundle | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()
  return data ?? null
}

function buildExtractionPrompts(htmlText: string, productType: ProductType) {
  const system = `You are a web content analyst. Extract information from webpage content and return valid JSON only — no markdown, no code fences, no extra text.`

  const imageGuidance =
    productType === "product"
      ? "the main product photo or packaging image"
      : "any representative image such as a hero banner, service illustration, team photo, or feature graphic"

  const user = `From the following webpage content, extract information about the ${productType}.

Return a JSON object with exactly these fields:
- name: string (the ${productType} name, max 200 chars)
- description: string (a compelling marketing description, max 80 words, written in present tense)
- image_url: string | null (the absolute URL of ${imageGuidance}; return null only if no image is present at all)

Rules:
- image_url must be an absolute URL starting with http:// or https://
- Prefer high-resolution images over thumbnails
- Never return a relative path for image_url

Webpage content:
${htmlText.slice(0, 12000)}`
  return { system, user }
}

function parseExtractionJson(raw: string): AiExtractionResult {
  const text = raw.trim()

  let parsed: Record<string, unknown> | undefined

  // Attempt 1: parse directly (handles clean JSON object)
  try {
    const result = JSON.parse(text)
    if (typeof result === "object" && result !== null && !Array.isArray(result)) {
      parsed = result as Record<string, unknown>
    } else if (typeof result === "string") {
      // Attempt 2: model double-stringified — parse the inner string
      try {
        const inner = JSON.parse(result)
        if (typeof inner === "object" && inner !== null) {
          parsed = inner as Record<string, unknown>
        }
      } catch {
        // fall through
      }
    }
  } catch {
    // Attempt 3: strip surrounding quotes / code fences, then extract {...}
    const stripped = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim()

    const firstBrace = stripped.indexOf("{")
    const lastBrace = stripped.lastIndexOf("}")
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        parsed = JSON.parse(stripped.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>
      } catch {
        // fall through
      }
    }
  }

  if (!parsed) {
    console.error("[product extract] All parse attempts failed. Raw (first 400):", text.slice(0, 400))
    throw new AppError({
      code: "EXTERNAL_SERVICE",
      message: `Failed to parse AI response: ${text.slice(0, 200)}`,
      userMessage: "AI returned an unexpected format. Please try again.",
    })
  }

  const imageUrl =
    typeof parsed.image_url === "string" && parsed.image_url.startsWith("http")
      ? parsed.image_url
      : null

  console.log(
    "[product extract] parsed name:", parsed.name,
    "| image_url raw:", parsed.image_url,
    "| image_url resolved:", imageUrl,
  )

  return {
    name: typeof parsed.name === "string" ? parsed.name.trim() : "Untitled",
    description:
      typeof parsed.description === "string" ? parsed.description.trim() : "",
    image_url: imageUrl,
  }
}

async function extractWithOpenAi(
  htmlText: string,
  productType: ProductType,
  model: string,
): Promise<AiExtractionResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new AppError({
      code: "EXTERNAL_SERVICE",
      message: "OPENAI_API_KEY is not configured",
      userMessage: "OpenAI is not configured. Add OPENAI_API_KEY to your environment.",
    })
  }

  const { system, user } = buildExtractionPrompts(htmlText, productType)
  const client = new OpenAI({ apiKey })

  const response = await client.chat.completions.create({
    model,
    temperature: 0.3,
    max_tokens: 2048,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  })

  const raw = response.choices[0]?.message?.content?.trim()
  if (!raw) {
    throw new AppError({
      code: "EXTERNAL_SERVICE",
      message: "OpenAI returned an empty response",
      userMessage: "AI extraction returned no results. Please try again.",
    })
  }

  return parseExtractionJson(raw)
}

async function extractWithGemini(
  htmlText: string,
  productType: ProductType,
  model: string,
): Promise<AiExtractionResult> {
  const { system, user } = buildExtractionPrompts(htmlText, productType)
  const genAI = getGeminiClient()
  const geminiModel = genAI.getGenerativeModel({
    model: resolveGeminiTextModel(model),
    systemInstruction: system,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
      // responseMimeType forces JSON output on supported models
      responseMimeType: "application/json",
    } as Record<string, unknown>,
  })

  let raw: string
  try {
    const result = await geminiModel.generateContent(user)
    raw = result.response.text().trim()
  } catch (error) {
    throw new AppError({
      code: "EXTERNAL_SERVICE",
      message: error instanceof Error ? error.message : "Gemini request failed",
      userMessage: formatGeminiApiError(error),
      cause: error,
    })
  }

  if (!raw) {
    throw new AppError({
      code: "EXTERNAL_SERVICE",
      message: "Gemini returned an empty response",
      userMessage: "AI extraction returned no results. Please try again.",
    })
  }

  return parseExtractionJson(raw)
}

async function extractProductInfoFromHtml(
  htmlText: string,
  productType: ProductType,
  settings: SettingsBundle | null,
): Promise<AiExtractionResult> {
  const provider = resolveTextProvider(settings)

  if (provider === "gemini") {
    return extractWithGemini(
      htmlText,
      productType,
      settings?.gemini_model ?? DEFAULT_GEMINI_TEXT_MODEL,
    )
  }

  return extractWithOpenAi(
    htmlText,
    productType,
    settings?.openai_model ?? "gpt-4o-mini",
  )
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function extractImageUrls(html: string): string[] {
  const urls: string[] = []
  // src attributes on img, picture source, og:image, twitter:image meta tags
  const patterns = [
    /< *img[^>]+src=["']([^"']+)["']/gi,
    /< *source[^>]+srcset=["']([^"'\s,]+)/gi,
    /property=["']og:image["'][^>]+content=["']([^"']+)["']/gi,
    /name=["']twitter:image["'][^>]+content=["']([^"']+)["']/gi,
    /content=["']([^"']+)["'][^>]+property=["']og:image["']/gi,
  ]
  for (const pattern of patterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(html)) !== null) {
      const raw = match[1]?.trim()
      if (!raw) continue
      const url = decodeHtmlEntities(raw)
      if (url.startsWith("http")) {
        urls.push(url)
      }
    }
  }
  // deduplicate
  return [...new Set(urls)]
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim()
}

function preparePageContent(html: string): string {
  const imageUrls = extractImageUrls(html)
  const visibleText = stripHtml(html)

  console.log("[product extract] image URLs found:", imageUrls.length, imageUrls.slice(0, 5))

  // Put the image section FIRST so it is never sliced away by the 14,000 char limit.
  // Prefer large images (width >= 400 or no size param) over thumbnails.
  const prioritized = imageUrls
    .filter((u) => {
      const wParam = u.match(/[?&]width=(\d+)/i)
      return !wParam || parseInt(wParam[1]) >= 400
    })
    .concat(imageUrls.filter((u) => !/[?&]width=\d+/i.test(u)))
  const deduped = [...new Set(prioritized)]

  const imageSection =
    deduped.length > 0
      ? `[IMAGE URLS FOUND ON PAGE]\n${deduped.slice(0, 15).join("\n")}\n\n`
      : ""

  return (imageSection + visibleText).slice(0, 14000)
}

export type ExtractResult = {
  name: string
  description: string
  image_url: string | null
}

export async function extractFromUrl(
  url: string,
  productType: ProductType,
): Promise<ActionResult<ExtractResult>> {
  try {
    const settings = await loadSettings(await getWorkspaceUserId())

    let html: string
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(15000),
      })

      if (!res.ok) {
        throw new AppError({
          code: "EXTERNAL_SERVICE",
          message: `HTTP ${res.status} fetching ${url}`,
          userMessage: `Could not access the URL (HTTP ${res.status}). Please check the address and try again.`,
        })
      }

      html = await res.text()
    } catch (err) {
      if (AppError.isAppError(err)) throw err
      throw new AppError({
        code: "EXTERNAL_SERVICE",
        message: err instanceof Error ? err.message : "Fetch failed",
        userMessage: "Could not reach the URL. Please check your connection and try again.",
      })
    }

    const pageContent = preparePageContent(html)
    const extracted = await extractProductInfoFromHtml(pageContent, productType, settings)

    return {
      success: true,
      data: extracted,
    }
  } catch (error) {
    return {
      success: false,
      error: AppError.fromUnknown(error).userMessage,
    }
  }
}

async function downloadAndStoreImage(
  imageUrl: string,
  userId: string,
  sourceUrl: string,
): Promise<string | null> {
  // Derive the origin of the source page to use as Referer (bypasses most hotlink protection)
  let referer = sourceUrl
  try {
    referer = new URL(sourceUrl).origin + "/"
  } catch {
    // fallback to full sourceUrl
  }

  // Request only formats Supabase product-images bucket accepts — omit avif so CDN falls back to webp/jpeg
  const imgRes = await fetch(imageUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: referer,
      Accept: "image/webp,image/jpeg,image/png,image/gif,image/*;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(15000),
    redirect: "follow",
  })

  if (!imgRes.ok) {
    throw new Error(`HTTP ${imgRes.status} fetching image`)
  }

  const rawContentType = imgRes.headers.get("content-type") ?? ""
  const mimeType = rawContentType.split(";")[0].trim()

  // Reject obviously non-image responses (HTML error pages, etc.)
  if (mimeType && !mimeType.startsWith("image/")) {
    throw new Error(`Unexpected content-type: ${mimeType}`)
  }

  // Validate it's actually an image (rejects HTML error pages etc.)
  // sharp will handle the actual format conversion, so any image/* type is fine here

  const rawBuffer = await imgRes.arrayBuffer()

  if (rawBuffer.byteLength === 0) {
    throw new Error("Empty image response")
  }

  // Convert to JPEG for consistent format and broad compatibility
  const jpegBuffer = await sharp(Buffer.from(rawBuffer))
    .jpeg({ quality: 90 })
    .toBuffer()

  const storagePath = `${userId}/${Date.now()}.jpg`

  const adminClient = createAdminClient()
  const { error: uploadError } = await adminClient.storage
    .from("product-images")
    .upload(storagePath, jpegBuffer, {
      contentType: "image/jpeg",
      upsert: false,
    })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  return storagePath
}

export async function uploadProductImage(
  formData: FormData,
): Promise<ActionResult<{ storagePath: string; previewUrl: string }>> {
  try {
    const userId = await getAuthUserId()
    const file = formData.get("file")

    if (!(file instanceof File) || file.size === 0) {
      return { success: false, error: "No file provided." }
    }

    const replacePath = formData.get("replace_storage_path")
    const pendingReplacePath =
      typeof replacePath === "string" && replacePath.startsWith(`${userId}/`)
        ? replacePath
        : null

    const rawBuffer = Buffer.from(await file.arrayBuffer())
    const jpegBuffer = await sharp(rawBuffer).jpeg({ quality: 90 }).toBuffer()

    const storagePath = `${userId}/${Date.now()}.jpg`
    const adminClient = createAdminClient()

    const { error: uploadError } = await adminClient.storage
      .from("product-images")
      .upload(storagePath, jpegBuffer, { contentType: "image/jpeg", upsert: false })

    if (uploadError) {
      throw new AppError({
        code: "INTERNAL",
        message: uploadError.message,
        userMessage: "Image upload failed. Please try again.",
      })
    }

    if (pendingReplacePath && pendingReplacePath !== storagePath) {
      await removeStoredProductImage(pendingReplacePath)
    }

    const { data: signData } = await adminClient.storage
      .from("product-images")
      .createSignedUrl(storagePath, 60 * 60)

    return {
      success: true,
      data: { storagePath, previewUrl: signData?.signedUrl ?? "" },
    }
  } catch (error) {
    return { success: false, error: AppError.fromUnknown(error).userMessage }
  }
}

export async function createProduct(
  values: ProductFormValues & {
    source_url?: string
    image_url?: string | null
    /** Pass when the image was already uploaded manually (skips server-side download). */
    pre_uploaded_storage_path?: string | null
  },
): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await getAuthUserId()
    const parsed = productFormSchema.safeParse(values)

    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Validation error" }
    }

    let imageStoragePath: string | null = values.pre_uploaded_storage_path ?? null

    // Download & convert from URL only when no pre-uploaded image was provided
    if (!imageStoragePath && values.image_url) {
      try {
        console.log("[product] Downloading image:", values.image_url)
        imageStoragePath = await downloadAndStoreImage(
          values.image_url,
          userId,
          values.source_url ?? values.image_url,
        )
        console.log("[product] Image stored at:", imageStoragePath)
      } catch (err) {
        console.warn("[product] Image download failed:", err)
      }
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("products")
      .insert({
        user_id: userId,
        type: parsed.data.type,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        source_url: values.source_url ?? parsed.data.source_url ?? null,
        image_storage_path: imageStoragePath,
        metadata: values.image_url ? { original_image_url: values.image_url } : {},
      })
      .select("id")
      .single()

    if (error || !data) {
      throw new AppError({
        code: "INTERNAL",
        message: error?.message ?? "Insert failed",
        userMessage: "Failed to save product. Please try again.",
      })
    }

    revalidatePath(PRODUCTS_PATH)
    return { success: true, data: { id: data.id } }
  } catch (error) {
    return { success: false, error: AppError.fromUnknown(error).userMessage }
  }
}

export async function getProducts(): Promise<ActionResult<ProductRow[]>> {
  try {
    const userId = await getAuthUserId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      throw new AppError({
        code: "INTERNAL",
        message: error.message,
        userMessage: "Failed to load products.",
      })
    }

    return { success: true, data: data ?? [] }
  } catch (error) {
    return { success: false, error: AppError.fromUnknown(error).userMessage }
  }
}

export type ProductImageSource = Pick<
  ProductRow,
  "id" | "image_storage_path" | "metadata"
>

export async function getProductImageUrls(
  products: ProductImageSource[],
): Promise<ActionResult<Record<string, string>>> {
  try {
    await getAuthUserId()

    const imageUrls: Record<string, string> = {}

    await Promise.all(
      products.map(async (product) => {
        if (product.image_storage_path) {
          const url = await createAdminSignedUrl(
            "product-images",
            product.image_storage_path,
            60 * 60,
          )
          if (url) {
            imageUrls[product.id] = url
          }
          return
        }

        const meta = product.metadata as Record<string, unknown> | null
        const externalUrl =
          typeof meta?.original_image_url === "string"
            ? meta.original_image_url
            : null

        if (externalUrl) {
          imageUrls[product.id] = externalUrl
        }
      }),
    )

    return { success: true, data: imageUrls }
  } catch (error) {
    return { success: false, error: AppError.fromUnknown(error).userMessage }
  }
}

async function removeStoredProductImage(storagePath: string): Promise<void> {
  if (!storagePath) return

  try {
    const adminClient = createAdminClient()
    const { error } = await adminClient.storage
      .from("product-images")
      .remove([storagePath])

    if (error) {
      console.warn("[product] Failed to delete stored image:", storagePath, error.message)
    }
  } catch (err) {
    console.warn("[product] Failed to delete stored image:", storagePath, err)
  }
}

export type UpdateProductInput = Partial<ProductFormValues> & {
  pre_uploaded_storage_path?: string | null
  remove_image?: boolean
}

export async function updateProduct(
  id: string,
  values: UpdateProductInput,
): Promise<ActionResult> {
  try {
    const userId = await getAuthUserId()
    const supabase = await createClient()

    const { pre_uploaded_storage_path, remove_image, ...formValues } = values
    const parsed = productFormSchema.partial().safeParse(formValues)

    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Validation error" }
    }

    const { data: existing, error: fetchError } = await supabase
      .from("products")
      .select("image_storage_path")
      .eq("id", id)
      .eq("user_id", userId)
      .single()

    if (fetchError || !existing) {
      return { success: false, error: "Product not found." }
    }

    const updatePayload: {
      type?: ProductType
      name?: string
      description?: string | null
      source_url?: string | null
      image_storage_path?: string | null
      metadata?: Record<string, never>
      updated_at: string
    } = {
      updated_at: new Date().toISOString(),
    }

    if (parsed.data.type !== undefined) updatePayload.type = parsed.data.type
    if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name
    if (parsed.data.description !== undefined) {
      updatePayload.description = parsed.data.description ?? null
    }
    if (parsed.data.source_url !== undefined) {
      updatePayload.source_url = parsed.data.source_url || null
    }

    if (pre_uploaded_storage_path) {
      if (
        existing.image_storage_path &&
        existing.image_storage_path !== pre_uploaded_storage_path
      ) {
        await removeStoredProductImage(existing.image_storage_path)
      }
      updatePayload.image_storage_path = pre_uploaded_storage_path
      updatePayload.metadata = {}
    } else if (remove_image) {
      if (existing.image_storage_path) {
        await removeStoredProductImage(existing.image_storage_path)
      }
      updatePayload.image_storage_path = null
      updatePayload.metadata = {}
    }

    const { error } = await supabase
      .from("products")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", userId)

    if (error) {
      throw new AppError({
        code: "INTERNAL",
        message: error.message,
        userMessage: "Failed to update product.",
      })
    }

    revalidatePath(PRODUCTS_PATH)
    return { success: true, data: undefined }
  } catch (error) {
    return { success: false, error: AppError.fromUnknown(error).userMessage }
  }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  try {
    const userId = await getAuthUserId()
    const supabase = await createClient()

    const { data: product } = await supabase
      .from("products")
      .select("image_storage_path")
      .eq("id", id)
      .eq("user_id", userId)
      .single()

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)

    if (error) {
      throw new AppError({
        code: "INTERNAL",
        message: error.message,
        userMessage: "Failed to delete product.",
      })
    }

    if (product?.image_storage_path) {
      await removeStoredProductImage(product.image_storage_path)
    }

    revalidatePath(PRODUCTS_PATH)
    return { success: true, data: undefined }
  } catch (error) {
    return { success: false, error: AppError.fromUnknown(error).userMessage }
  }
}

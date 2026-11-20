import { SEEDANCE_REFS_BUCKET } from "@/lib/seedance/constants"
import type { GeminiClipState } from "@/services/gemini/omni"
import { downloadGeminiClip } from "@/services/gemini/omni"
import { createAdminClient } from "@/services/supabase/admin"

const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7

export async function applyGeminiOutcome(input: {
  jobId: string
  userId: string
  state: GeminiClipState
}): Promise<"succeeded" | "failed" | "processing" | "ignored"> {
  if (input.state.status === "processing") {
    return "processing"
  }

  const admin = createAdminClient()

  if (input.state.status === "succeeded") {
    const clip = await downloadGeminiClip({
      outputUrl: input.state.outputUrl,
      outputBase64: input.state.outputBase64,
    })
    const outputPath = `${input.userId}/outputs/${input.jobId}.mp4`
    const { error: uploadError } = await admin.storage
      .from(SEEDANCE_REFS_BUCKET)
      .upload(outputPath, clip.bytes, {
        contentType: clip.mimeType,
        upsert: true,
      })
    if (uploadError) {
      throw new Error(uploadError.message)
    }

    const { data: signed, error: signError } = await admin.storage
      .from(SEEDANCE_REFS_BUCKET)
      .createSignedUrl(outputPath, SIGNED_URL_SECONDS)
    if (signError || !signed?.signedUrl) {
      throw new Error(signError?.message || "Could not sign the Gemini clip.")
    }

    const { data: updated, error } = await admin
      .from("seedance_jobs")
      .update({
        status: "succeeded",
        output_url: signed.signedUrl,
        output_path: outputPath,
        error: null,
      })
      .eq("id", input.jobId)
      .in("status", ["queued", "processing"])
      .select("id")

    if (error) throw new Error(error.message)
    return updated && updated.length > 0 ? "succeeded" : "ignored"
  }

  const { data: updated, error } = await admin
    .from("seedance_jobs")
    .update({
      status: "failed",
      error: input.state.error?.trim() || "Generation failed",
      output_url: null,
    })
    .eq("id", input.jobId)
    .in("status", ["queued", "processing"])
    .select("id")

  if (error) throw new Error(error.message)
  return updated && updated.length > 0 ? "failed" : "ignored"
}

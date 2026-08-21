import { z } from "zod"

export const seedanceGenerateBodySchema = z
  .object({
    prompt: z.string().trim().min(1, "Prompt is required").max(8000),
    imagePaths: z.array(z.string().min(1)).max(9).default([]),
    assetUris: z
      .array(z.string().regex(/^asset:\/\/.+/))
      .max(9)
      .default([]),
    audioPath: z.string().min(1).nullable().optional(),
    modelOptionId: z
      .enum(["seedance_2_5", "seedance_2_0", "seedance_2_0_fast"])
      .default("seedance_2_5"),
    durationSeconds: z.number().int().min(1).max(30).default(5),
    ratio: z
      .enum(["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"])
      .default("9:16"),
    quality: z.enum(["standard", "pro"]).default("standard"),
    generateAudio: z.boolean().default(true),
  })
  .refine(
    (data) => data.imagePaths.length + data.assetUris.length <= 9,
    { message: "At most 9 reference images (uploads + avatars)." },
  )

export type SeedanceGenerateBody = z.infer<typeof seedanceGenerateBodySchema>

export const seedanceJobStatusSchema = z.enum([
  "queued",
  "processing",
  "succeeded",
  "failed",
])

export type SeedanceJobStatus = z.infer<typeof seedanceJobStatusSchema>

export interface SeedanceJobRow {
  id: string
  user_id: string
  provider_task_id: string | null
  status: SeedanceJobStatus
  prompt: string
  output_url: string | null
  error: string | null
  created_at: string
  updated_at: string
}

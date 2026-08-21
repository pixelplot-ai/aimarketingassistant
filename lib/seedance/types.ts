import { z } from "zod"

export const seedanceGenerateBodySchema = z.object({
  prompt: z.string().trim().min(1, "Prompt is required").max(8000),
  imagePaths: z.array(z.string().min(1)).max(9).default([]),
  audioPath: z.string().min(1).nullable().optional(),
  modelOptionId: z.enum(["seedance_2_0", "seedance_2_0_fast"]).default("seedance_2_0"),
  durationSeconds: z.union([z.literal(5), z.literal(10)]).default(5),
  ratio: z
    .enum(["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"])
    .default("9:16"),
  quality: z.enum(["standard", "pro"]).default("standard"),
  generateAudio: z.boolean().default(true),
})

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

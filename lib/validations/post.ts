import { z } from "zod"

import type { Enums } from "@/types/database"

const mediaTypeSchema = z.enum([
  "none",
  "image",
  "video",
]) satisfies z.ZodType<Enums<"media_type">>

export const postFormSchema = z
  .object({
    title: z.string().max(200, "Title is too long"),
    content: z.string().max(5000, "Content is too long"),
    media_type: mediaTypeSchema,
    scheduled_at: z.string().nullable().optional(),
    timezone: z.string().min(1, "Timezone is required"),
    platform_ids: z
      .array(z.string().min(1))
      .min(1, "Select at least one platform"),
    brand_profile_id: z.string().uuid().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.title.trim() && !data.content.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Add post text or an internal title",
        path: ["content"],
      })
    }

    if (data.scheduled_at) {
      const scheduledDate = new Date(data.scheduled_at)
      if (Number.isNaN(scheduledDate.getTime())) {
        ctx.addIssue({
          code: "custom",
          message: "Invalid schedule date",
          path: ["scheduled_at"],
        })
        return
      }

      if (scheduledDate.getTime() > Date.now() && !data.content.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "Post text is required to schedule",
          path: ["content"],
        })
      }
    }
  })

export type PostFormValues = z.infer<typeof postFormSchema>

export const postFilterSchema = z.object({
  search: z.string().optional(),
  status: z
    .enum([
      "all",
      "draft",
      "scheduled",
      "publishing",
      "published",
      "failed",
      "cancelled",
    ])
    .default("all"),
  media_type: z.enum(["all", "none", "image", "video"]).default("all"),
  platform_id: z.string().default("all"),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  sort_by: z
    .enum(["created_at", "updated_at", "scheduled_at", "title"])
    .default("created_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(10),
})

export type PostFilterValues = z.infer<typeof postFilterSchema>

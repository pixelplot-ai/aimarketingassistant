import { z } from "zod"

import {
  BRAND_VALUES_OPTIONS,
  BRAND_VOICE_OPTIONS,
  CTA_OPTIONS,
  WRITING_STYLE_OPTIONS,
} from "@/features/brand/constants"

const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Enter a valid hex color (e.g. #2563eb)")

export const brandProfileFormSchema = z.object({
  id: z.string().uuid().optional(),
  brand_name: z
    .string()
    .min(1, "Brand name is required")
    .max(200, "Brand name is too long"),
  business_description: z
    .string()
    .min(1, "Business description is required")
    .max(2000, "Description is too long"),
  industry: z
    .string()
    .min(1, "Industry is required")
    .max(200, "Industry is too long"),
  target_audience: z
    .string()
    .min(1, "Target audience is required")
    .max(2000, "Target audience is too long"),
  brand_voice: z
    .array(z.enum(BRAND_VOICE_OPTIONS))
    .min(1, "Select at least one brand voice"),
  writing_style: z
    .array(z.enum(WRITING_STYLE_OPTIONS))
    .min(1, "Select at least one writing style"),
  brand_values: z
    .array(z.enum(BRAND_VALUES_OPTIONS))
    .min(1, "Select at least one brand value"),
  preferred_ctas: z
    .array(z.enum(CTA_OPTIONS))
    .min(1, "Select at least one call-to-action"),
  keywords: z.array(z.string().min(1).max(100)).max(50, "Too many keywords"),
  avoid_words: z.array(z.string().min(1).max(100)).max(50, "Too many words"),
  competitors: z.array(z.string().min(1).max(200)).max(20, "Too many competitors"),
  color_primary: hexColorSchema,
  color_secondary: hexColorSchema,
  color_accent: hexColorSchema,
})

export type BrandProfileFormValues = z.infer<typeof brandProfileFormSchema>

export const extractBrandFromUrlSchema = z.object({
  url: z.string().url("Enter a valid website URL"),
})

export type ExtractBrandFromUrlValues = z.infer<typeof extractBrandFromUrlSchema>

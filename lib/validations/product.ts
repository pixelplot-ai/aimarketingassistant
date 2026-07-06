import { z } from "zod"

export const productTypeSchema = z.enum(["product", "service"])
export type ProductType = z.infer<typeof productTypeSchema>

export const extractProductSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
  type: productTypeSchema,
})
export type ExtractProductValues = z.infer<typeof extractProductSchema>

export const productFormSchema = z.object({
  type: productTypeSchema,
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  description: z.string().max(600, "Description is too long").optional(),
  source_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  image_storage_path: z.string().optional(),
})
export type ProductFormValues = z.infer<typeof productFormSchema>

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  product: "Product",
  service: "Service",
}

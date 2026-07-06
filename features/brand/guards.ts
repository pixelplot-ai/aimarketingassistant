import { AppError } from "@/lib/errors/app-error"
import type { BrandProfileFormValues } from "@/lib/validations/brand-profile"
import type { BrandProfileRow } from "@/types/app"

export function getDefaultBrandProfile(userId: string): Omit<
  BrandProfileRow,
  "id" | "created_at" | "updated_at" | "deleted_at"
> {
  return {
    user_id: userId,
    brand_name: "",
    business_description: "",
    industry: "",
    website: null,
    email: null,
    phone: null,
    address: null,
    target_audience: "",
    brand_voice: [],
    writing_style: [],
    brand_values: [],
    products_services: [],
    preferred_ctas: [],
    keywords: [],
    avoid_words: [],
    competitors: [],
    color_primary: "#2563eb",
    color_secondary: "#64748b",
    color_accent: "#f59e0b",
    logo_storage_path: null,
    is_default: true,
    is_complete: false,
  }
}

type CompletenessInput = Pick<
  BrandProfileFormValues,
  | "brand_name"
  | "business_description"
  | "industry"
  | "target_audience"
  | "brand_voice"
  | "writing_style"
  | "brand_values"
  | "preferred_ctas"
  | "color_primary"
  | "color_secondary"
  | "color_accent"
>

export function computeBrandProfileComplete(
  profile: CompletenessInput,
): boolean {
  return (
    profile.brand_name.trim().length > 0 &&
    profile.business_description.trim().length > 0 &&
    profile.industry.trim().length > 0 &&
    profile.target_audience.trim().length > 0 &&
    profile.brand_voice.length > 0 &&
    profile.writing_style.length > 0 &&
    profile.brand_values.length > 0 &&
    profile.preferred_ctas.length > 0 &&
    Boolean(profile.color_primary) &&
    Boolean(profile.color_secondary) &&
    Boolean(profile.color_accent)
  )
}

export function assertBrandProfileComplete(
  profile: BrandProfileRow | BrandProfileFormValues | null | undefined,
): asserts profile is BrandProfileRow | BrandProfileFormValues {
  if (!profile) {
    throw new AppError({
      code: "VALIDATION",
      message: "Brand profile not found",
      userMessage:
        "Please configure your Brand Profile before using AI features.",
    })
  }

  const isComplete =
    "is_complete" in profile && typeof profile.is_complete === "boolean"
      ? profile.is_complete
      : computeBrandProfileComplete(profile as BrandProfileFormValues)

  if (!isComplete) {
    throw new AppError({
      code: "VALIDATION",
      message: "Brand profile is incomplete",
      userMessage:
        "Please configure your Brand Profile before using AI features.",
    })
  }
}

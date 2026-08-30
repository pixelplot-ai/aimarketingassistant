import { z } from "zod"

import {
  TASK_CATEGORIES,
  TASK_CATEGORY_LABELS,
  type TaskCategory,
} from "@/lib/organizer/tasks"

export const GOAL_HORIZONS = ["short", "medium", "long"] as const
export type GoalHorizon = (typeof GOAL_HORIZONS)[number]

export const GOAL_HORIZON_LABELS: Record<GoalHorizon, string> = {
  short: "Short term · 1 month",
  medium: "Medium term · 6 months",
  long: "Long term · 12+ months",
}

export const GOAL_HORIZON_SHORT_LABELS: Record<GoalHorizon, string> = {
  short: "1 month",
  medium: "6 months",
  long: "12+ months",
}

export const GOAL_CATEGORIES = TASK_CATEGORIES
export type GoalCategory = TaskCategory
export const GOAL_CATEGORY_LABELS = TASK_CATEGORY_LABELS

export const GOAL_CATEGORY_COLORS: Record<GoalCategory, string> = {
  sales: "oklch(0.62 0.18 25)",
  marketing: "oklch(0.62 0.16 250)",
  product: "oklch(0.62 0.15 145)",
  administrative: "oklch(0.58 0.08 280)",
}

export type OrganizerGoalRow = {
  id: string
  title: string
  description: string
  horizon: GoalHorizon
  categories: GoalCategory[]
  created_by: string
  created_at: string
  updated_at: string
}

export function normalizeGoalCategories(
  values: readonly string[] | null | undefined,
  fallback: GoalCategory = "administrative",
): GoalCategory[] {
  const unique: GoalCategory[] = []
  for (const value of values ?? []) {
    if (
      (GOAL_CATEGORIES as readonly string[]).includes(value) &&
      !unique.includes(value as GoalCategory)
    ) {
      unique.push(value as GoalCategory)
    }
  }
  return unique.length > 0 ? unique : [fallback]
}

export type GoalAllocations = Record<GoalCategory, number>

export const DEFAULT_ALLOCATIONS: GoalAllocations = {
  sales: 25,
  marketing: 25,
  product: 25,
  administrative: 25,
}

export function allocationsFromRows(
  rows: { category: string; percent: number }[],
): GoalAllocations {
  const next = { ...DEFAULT_ALLOCATIONS }
  for (const row of rows) {
    if ((GOAL_CATEGORIES as readonly string[]).includes(row.category)) {
      next[row.category as GoalCategory] = row.percent
    }
  }
  return next
}

export function allocationSum(allocations: GoalAllocations): number {
  return GOAL_CATEGORIES.reduce((sum, key) => sum + (allocations[key] ?? 0), 0)
}

/** Set one category percent and proportionally adjust the others so the total stays 100. */
export function setAllocationPercent(
  current: GoalAllocations,
  category: GoalCategory,
  nextPercent: number,
): GoalAllocations {
  const target = Math.min(100, Math.max(0, Math.round(nextPercent)))
  const others = GOAL_CATEGORIES.filter((key) => key !== category)
  const remaining = 100 - target

  if (others.length === 0) {
    return { ...current, [category]: 100 }
  }

  const othersSum = others.reduce((sum, key) => sum + current[key], 0)
  const next: GoalAllocations = { ...current, [category]: target }

  if (othersSum <= 0) {
    const base = Math.floor(remaining / others.length)
    let leftover = remaining - base * others.length
    for (const key of others) {
      next[key] = base + (leftover > 0 ? 1 : 0)
      if (leftover > 0) leftover -= 1
    }
    return next
  }

  const parts = others.map((key) => {
    const exact = (current[key] / othersSum) * remaining
    return {
      key,
      floor: Math.floor(exact),
      frac: exact - Math.floor(exact),
    }
  })

  parts.sort((a, b) => b.frac - a.frac)
  let used = parts.reduce((sum, part) => sum + part.floor, 0)
  let leftover = remaining - used

  for (const part of parts) {
    next[part.key] = part.floor
  }
  for (let i = 0; leftover > 0; i += 1, leftover -= 1) {
    next[parts[i % parts.length]!.key] += 1
  }

  return next
}

/** Move percent between two adjacent categories; their combined total stays fixed. */
export function tradeAllocationBetween(
  current: GoalAllocations,
  left: GoalCategory,
  right: GoalCategory,
  nextLeftPercent: number,
): GoalAllocations {
  const pairSum = current[left] + current[right]
  const nextLeft = Math.min(pairSum, Math.max(0, Math.round(nextLeftPercent)))
  return {
    ...current,
    [left]: nextLeft,
    [right]: pairSum - nextLeft,
  }
}

const goalCategoriesSchema = z
  .array(z.enum(GOAL_CATEGORIES))
  .min(1, "Pick at least one category")
  .transform((values) => normalizeGoalCategories(values))

export const createGoalBodySchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(5000).default(""),
  horizon: z.enum(GOAL_HORIZONS),
  categories: goalCategoriesSchema.default(["administrative"]),
})

export type CreateGoalBody = z.infer<typeof createGoalBodySchema>

export const patchGoalBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    horizon: z.enum(GOAL_HORIZONS).optional(),
    categories: goalCategoriesSchema.optional(),
  })
  .refine(
    (body) =>
      body.title !== undefined ||
      body.description !== undefined ||
      body.horizon !== undefined ||
      body.categories !== undefined,
    { message: "No fields to update" },
  )

export type PatchGoalBody = z.infer<typeof patchGoalBodySchema>

export const allocationsBodySchema = z
  .object({
    sales: z.number().int().min(0).max(100),
    marketing: z.number().int().min(0).max(100),
    product: z.number().int().min(0).max(100),
    administrative: z.number().int().min(0).max(100),
  })
  .refine((body) => allocationSum(body) === 100, {
    message: "Allocations must sum to 100%",
  })

export type AllocationsBody = z.infer<typeof allocationsBodySchema>

export const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-card"

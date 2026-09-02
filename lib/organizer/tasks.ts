import { z } from "zod"

export const TASK_CATEGORIES = [
  "sales",
  "marketing",
  "product",
  "administrative",
] as const

export type TaskCategory = (typeof TASK_CATEGORIES)[number]

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  sales: "Sales",
  marketing: "Marketing",
  product: "Product",
  administrative: "Administrative",
}

export const TASK_STATUSES = ["scheduled", "done"] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export type OrganizerTaskRow = {
  id: string
  title: string
  description: string
  category: TaskCategory
  assignee_id: string | null
  created_by: string
  status: TaskStatus
  sort_order: number
  progress: number
  notes: string
  due_date: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export function formatTaskDate(value: string, includeYear = false): string {
  const date = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" as const } : {}),
  })
}

/** Local calendar date as YYYY-MM-DD. */
export function todayDateKey(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function isDueDateExpired(
  dueDate: string | null | undefined,
  now = new Date(),
): boolean {
  if (!dueDate) return false
  return dueDate < todayDateKey(now)
}

const optionalDueDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
  .nullable()
  .optional()
  .refine(
    (value) => value == null || value.length === 0 || value >= todayDateKey(),
    { message: "Due date must be today or in the future" },
  )

export const createTaskBodySchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(5000).default(""),
  category: z.enum(TASK_CATEGORIES).default("administrative"),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: optionalDueDateSchema,
})

export type CreateTaskBody = z.infer<typeof createTaskBodySchema>

export const patchTaskBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    category: z.enum(TASK_CATEGORIES).optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    dueDate: optionalDueDateSchema,
    notes: z.string().max(5000).optional(),
    progress: z.number().int().min(0).max(100).optional(),
    status: z.enum(TASK_STATUSES).optional(),
  })
  .refine(
    (body) =>
      body.title !== undefined ||
      body.description !== undefined ||
      body.category !== undefined ||
      body.assigneeId !== undefined ||
      body.dueDate !== undefined ||
      body.notes !== undefined ||
      body.progress !== undefined ||
      body.status !== undefined,
    { message: "No fields to update" },
  )

export type PatchTaskBody = z.infer<typeof patchTaskBodySchema>

export const reorderTasksBodySchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
})

export type ReorderTasksBody = z.infer<typeof reorderTasksBodySchema>

export type TaskSortKey = "priority" | "title" | "progress" | "newest"

/** Top = red, middle = orange, bottom = green based on rank in scheduled list. */
export function priorityTone(
  index: number,
  total: number,
): "high" | "medium" | "low" {
  if (total <= 1) return "high"
  const t = index / (total - 1)
  if (t <= 0.33) return "high"
  if (t <= 0.66) return "medium"
  return "low"
}

export const PRIORITY_STYLES = {
  high: {
    bar: "bg-red-500",
    border: "border-l-red-500",
    chip: "bg-red-500/15 text-red-700 dark:text-red-300",
    label: "High",
  },
  medium: {
    bar: "bg-orange-500",
    border: "border-l-orange-500",
    chip: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    label: "Medium",
  },
  low: {
    bar: "bg-emerald-500",
    border: "border-l-emerald-500",
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    label: "Low",
  },
} as const

export const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-card"

import { z } from "zod"

import { formatTaskDate, todayDateKey } from "@/lib/organizer/tasks"

export const LEAD_TEMPERATURES = ["hot", "warm", "cold"] as const
export type LeadTemperature = (typeof LEAD_TEMPERATURES)[number]

export const LEAD_STAGES = [
  "new",
  "attempting",
  "connected",
  "qualified",
  "disqualified",
] as const
export type LeadStage = (typeof LEAD_STAGES)[number]

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  attempting: "Attempting",
  connected: "Connected",
  qualified: "Qualified",
  disqualified: "Disqualified",
}

export const DISQUALIFY_REASONS = ["not_interested", "bad_fit", "no_response"] as const
export type DisqualifyReason = (typeof DISQUALIFY_REASONS)[number]

export const DISQUALIFY_REASON_LABELS: Record<DisqualifyReason, string> = {
  not_interested: "Not interested",
  bad_fit: "Bad fit",
  no_response: "No response",
}

export const NEXT_STEPS = ["email", "call", "whatsapp", "meeting", "offer"] as const
export type NextStep = (typeof NEXT_STEPS)[number]

export const NEXT_STEP_LABELS: Record<NextStep, string> = {
  email: "Email",
  call: "Call",
  whatsapp: "WhatsApp",
  meeting: "Meeting",
  offer: "Offer",
}

export const LEAD_CHANNELS = ["mail", "phone", "whatsapp"] as const
export type LeadChannel = (typeof LEAD_CHANNELS)[number]

export const LEAD_SOURCES = ["event", "manual", "referral"] as const
export type LeadSource = (typeof LEAD_SOURCES)[number]

export const ACTIVITY_KINDS = [
  "email",
  "call",
  "reply",
  "meeting",
  "note",
  "whatsapp",
  "offer",
] as const
export type ActivityKind = (typeof ACTIVITY_KINDS)[number]

export const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = {
  email: "Email",
  call: "Call",
  reply: "Reply",
  meeting: "Meeting",
  note: "Note",
  whatsapp: "WhatsApp",
  offer: "Offer",
}

export const LEAD_QUEUES = ["now", "closed"] as const
export type LeadQueue = (typeof LEAD_QUEUES)[number]

export type OrganizerLeadActivityRow = {
  id: string
  lead_id: string
  happened_on: string
  author: string
  kind: ActivityKind
  body: string
  created_at: string
}

export type OrganizerLeadRow = {
  id: string
  external_id: string | null
  salutation: string
  first_name: string
  last_name: string
  email: string
  phone: string
  temperature: LeadTemperature | null
  stage: LeadStage
  disqualify_reason: DisqualifyReason | null
  notes: string
  scanned_at: string | null
  scanned_by: string
  job_title: string
  company: string
  job_function: string
  industry: string
  turnover_band: string
  employee_band: string
  country: string
  source: LeadSource
  channel: LeadChannel | null
  owner_name: string
  first_contact_on: string | null
  answered: boolean
  next_step: NextStep | null
  next_action_on: string | null
  next_action_time: string | null
  next_action: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export type OrganizerLead = OrganizerLeadRow & {
  activities: OrganizerLeadActivityRow[]
}

export const selectClassName =
  "h-10 w-full rounded-lg border border-input bg-background px-2.5 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-8 md:text-sm dark:bg-card"

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
  .nullable()
  .optional()

const optionalTime = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Invalid time")
  .nullable()
  .optional()

export const createLeadBodySchema = z.object({
  salutation: z.string().trim().max(20).default(""),
  firstName: z.string().trim().max(80).default(""),
  lastName: z.string().trim().max(80).default(""),
  email: z.string().trim().max(200).default(""),
  phone: z.string().trim().max(40).default(""),
  temperature: z.enum(LEAD_TEMPERATURES).nullable().optional(),
  company: z.string().trim().max(160).default(""),
  jobTitle: z.string().trim().max(160).default(""),
  notes: z.string().trim().max(5000).default(""),
  ownerName: z.string().trim().max(80).default(""),
  nextStep: z.enum(NEXT_STEPS).default("email"),
  nextActionOn: optionalDate,
  nextActionTime: optionalTime,
  nextAction: z.string().trim().max(500).default(""),
})

export type CreateLeadBody = z.infer<typeof createLeadBodySchema>

export const activityBodySchema = z.object({
  kind: z.enum(ACTIVITY_KINDS),
  body: z.string().trim().min(1, "Write what happened").max(5000),
  author: z.string().trim().max(80).default(""),
  happenedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
    .optional(),
})

export const closeStepBodySchema = z.object({
  mode: z.enum(["next", "close"]),
  outcome: z.string().trim().min(1, "Write what happened").max(2000),
  happenedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
    .optional(),
  nextStep: z.enum(NEXT_STEPS).optional(),
  nextActionOn: optionalDate,
  nextActionTime: optionalTime,
  nextAction: z.string().trim().max(500).optional(),
  stage: z.enum(["qualified", "disqualified"]).optional(),
  disqualifyReason: z.enum(DISQUALIFY_REASONS).nullable().optional(),
})

export type CloseStepBody = z.infer<typeof closeStepBodySchema>

export function closeStepError(step: CloseStepBody): string | null {
  if (!step.outcome.trim()) return "Write what happened"
  if (step.mode === "next") {
    if (!step.nextStep) return "Open leads need a next step"
    if (!step.nextAction?.trim()) return "Write the next step"
  }
  if (step.mode === "close") {
    if (step.stage !== "qualified" && step.stage !== "disqualified") {
      return "Choose how the collaboration ends"
    }
    if (step.stage === "disqualified" && !step.disqualifyReason) {
      return "Disqualified leads need a reason"
    }
  }
  return null
}

export function stageAfterClosedStep(stage: LeadStage, step: NextStep): LeadStage {
  if (isClosedStage(stage)) return stage
  if (step === "meeting" || step === "offer") return "connected"
  if ((step === "email" || step === "call" || step === "whatsapp") && stage === "new") {
    return "attempting"
  }
  return stage
}

export const patchLeadBodySchema = z
  .object({
    salutation: z.string().trim().max(20).optional(),
    firstName: z.string().trim().max(80).optional(),
    lastName: z.string().trim().max(80).optional(),
    email: z.string().trim().max(200).optional(),
    phone: z.string().trim().max(40).optional(),
    temperature: z.enum(LEAD_TEMPERATURES).nullable().optional(),
    stage: z.enum(LEAD_STAGES).optional(),
    disqualifyReason: z.enum(DISQUALIFY_REASONS).nullable().optional(),
    notes: z.string().trim().max(5000).optional(),
    jobTitle: z.string().trim().max(160).optional(),
    company: z.string().trim().max(160).optional(),
    jobFunction: z.string().trim().max(160).optional(),
    industry: z.string().trim().max(160).optional(),
    turnoverBand: z.string().trim().max(160).optional(),
    employeeBand: z.string().trim().max(160).optional(),
    country: z.string().trim().max(80).optional(),
    channel: z.enum(LEAD_CHANNELS).nullable().optional(),
    ownerName: z.string().trim().max(80).optional(),
    nextStep: z.enum(NEXT_STEPS).nullable().optional(),
    nextActionOn: optionalDate,
    nextActionTime: optionalTime,
    nextAction: z.string().trim().max(500).optional(),
    activity: activityBodySchema.optional(),
    closeStep: closeStepBodySchema.optional(),
  })
  .refine(
    (body) =>
      body.activity !== undefined ||
      body.closeStep !== undefined ||
      Object.entries(body).some(
        ([key, value]) => key !== "activity" && key !== "closeStep" && value !== undefined,
      ),
    { message: "No fields to update" },
  )

export type PatchLeadBody = z.infer<typeof patchLeadBodySchema>

export function leadDisplayName(
  lead: Pick<OrganizerLeadRow, "first_name" | "last_name" | "email">,
): string {
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim()
  return name || lead.email || "Unnamed lead"
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (!digits) return ""
  if (digits.startsWith("00")) return normalizePhone(digits.slice(2))
  if (digits.startsWith("40") && digits.length >= 11) return digits
  if (digits.startsWith("0") && digits.length === 10) return `4${digits}`
  if (digits.startsWith("7") && digits.length === 9) return `40${digits}`
  return digits
}

export function isClosedStage(stage: LeadStage): boolean {
  return stage === "qualified" || stage === "disqualified"
}

export function stageAfterActivity(stage: LeadStage, kind: ActivityKind): LeadStage {
  if (isClosedStage(stage)) return stage
  if (kind === "reply") return "connected"
  if ((kind === "email" || kind === "call") && stage === "new") return "attempting"
  return stage
}

function dayUtc(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

/** Business days strictly after `start` and on or before `end`. */
export function businessDaysBetween(start: string, end: string): number {
  const cursor = dayUtc(start)
  const last = dayUtc(end)
  if (last <= cursor) return 0
  let count = 0
  cursor.setUTCDate(cursor.getUTCDate() + 1)
  while (cursor <= last) {
    const weekday = cursor.getUTCDay()
    if (weekday !== 0 && weekday !== 6) count += 1
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return count
}

export function normalizeLeadTime(value: string | null | undefined): string | null {
  if (!value) return null
  const match = value.match(/^(\d{2}):(\d{2})/)
  return match ? `${match[1]}:${match[2]}` : null
}

export function nowTimeKey(now = new Date()): string {
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
}

export type NextStepTiming = "overdue" | "today" | "upcoming" | "none"

export function nextStepTiming(
  lead: OrganizerLeadRow,
  today = todayDateKey(),
  now = new Date(),
): NextStepTiming {
  if (!lead.next_action_on || isClosedStage(lead.stage)) return "none"
  if (lead.next_action_on < today) return "overdue"
  if (lead.next_action_on > today) return "upcoming"
  const time = normalizeLeadTime(lead.next_action_time)
  if (time && time < nowTimeKey(now)) return "overdue"
  return "today"
}

export function isLeadOverdue(
  lead: OrganizerLeadRow,
  today = todayDateKey(),
  now = new Date(),
): boolean {
  if (isClosedStage(lead.stage)) return false
  if (lead.next_action_on && lead.next_action_on < today) return true
  if (lead.next_action_on === today) {
    const time = normalizeLeadTime(lead.next_action_time)
    if (time && time < nowTimeKey(now)) return true
  }
  if (lead.first_contact_on || !lead.scanned_at) return false
  const limit = lead.temperature === "hot" ? 1 : lead.temperature === "warm" ? 2 : null
  if (limit == null) return false
  return businessDaysBetween(lead.scanned_at, today) >= limit
}

export function leadQueue(lead: OrganizerLeadRow): LeadQueue {
  if (isClosedStage(lead.stage)) return "closed"
  return "now"
}

export function lastTouchOn(lead: OrganizerLead): string | null {
  const dates = lead.activities.map((activity) => activity.happened_on)
  if (lead.first_contact_on) dates.push(lead.first_contact_on)
  if (dates.length === 0) return null
  return dates.sort().at(-1) ?? null
}

export function firstTouchOn(lead: OrganizerLead): string | null {
  const dates = [
    ...lead.activities.map((activity) => activity.happened_on),
    ...(lead.first_contact_on ? [lead.first_contact_on] : []),
  ]
  if (dates.length === 0) return null
  return dates.sort()[0] ?? null
}

function dueSortKey(lead: OrganizerLeadRow): string {
  const date = lead.next_action_on ?? "9999-12-31"
  const time = normalizeLeadTime(lead.next_action_time) ?? "99:99"
  return `${date}T${time}`
}

export function compareByNextStep(a: OrganizerLead, b: OrganizerLead): number {
  const byDue = dueSortKey(a).localeCompare(dueSortKey(b))
  if (byDue !== 0) return byDue
  return leadDisplayName(a).localeCompare(leadDisplayName(b))
}

export function formatLeadDate(value: string | null | undefined): string {
  if (!value) return "—"
  return formatTaskDate(value, true)
}

export function formatLeadWhen(
  date: string | null | undefined,
  time: string | null | undefined,
): string {
  const clock = normalizeLeadTime(time)
  if (!date) return clock ?? "—"
  const day = formatLeadDate(date)
  return clock ? `${day} · ${clock}` : day
}

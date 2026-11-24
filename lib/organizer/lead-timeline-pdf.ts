import {
  NEXT_STEP_LABELS,
  compareByNextStep,
  leadDisplayName,
  nextStepTiming,
  normalizeLeadTime,
  type NextStepTiming,
  type OrganizerLead,
} from "@/lib/organizer/leads"
import { todayDateKey } from "@/lib/organizer/tasks"

const TIMELINE_DAYS = 3

const STEP_COLORS: Record<Exclude<NextStepTiming, "none">, string> = {
  overdue: "#dc2626",
  today: "#d97706",
  upcoming: "#059669",
}

function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number)
  const date = new Date(year!, month! - 1, day)
  date.setDate(date.getDate() + days)
  return todayDateKey(date)
}

function formatTimelineDay(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number)
  return new Date(year!, month! - 1, day).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  })
}

export function timelineDateKeys(today = todayDateKey()): string[] {
  return Array.from({ length: TIMELINE_DAYS }, (_, index) => addDays(today, index))
}

export function buildLeadTimelineDefinition(leads: OrganizerLead[], today = todayDateKey()) {
  const keys = timelineDateKeys(today)
  const allowed = new Set(keys)
  const grouped = new Map<string, OrganizerLead[]>()
  for (const key of keys) grouped.set(key, [])
  for (const lead of leads) {
    if (!lead.next_action_on || !allowed.has(lead.next_action_on)) continue
    if (nextStepTiming(lead, today) === "none") continue
    grouped.get(lead.next_action_on)?.push(lead)
  }
  for (const list of grouped.values()) list.sort(compareByNextStep)

  const content: Record<string, unknown>[] = [
    { text: "Next 3 days", fontSize: 20, bold: true, margin: [0, 0, 0, 2] },
    {
      text: `${formatTimelineDay(keys[0]!)} – ${formatTimelineDay(keys[2]!)}`,
      fontSize: 11,
      color: "#64748b",
      margin: [0, 0, 0, 4],
    },
    {
      text: "One step after another, including today.",
      fontSize: 9,
      color: "#94a3b8",
      margin: [0, 0, 0, 8],
    },
  ]

  let step = 1
  for (const key of keys) {
    const dayLeads = grouped.get(key) ?? []
    content.push({
      text: formatTimelineDay(key),
      fontSize: 13,
      bold: true,
      color: key === today ? "#0369a1" : "#0f172a",
      margin: [0, 14, 0, 8],
    })
    if (dayLeads.length === 0) {
      content.push({
        text: "Nothing scheduled",
        italics: true,
        color: "#94a3b8",
        margin: [30, 0, 0, 2],
      })
      continue
    }
    for (const lead of dayLeads) {
      const timing = nextStepTiming(lead, today)
      const color = timing === "none" ? "#64748b" : STEP_COLORS[timing]
      const time = normalizeLeadTime(lead.next_action_time) ?? "No time"
      const company = lead.company.trim()
      const name = company ? `${leadDisplayName(lead)} (${company})` : leadDisplayName(lead)
      const details = [
        {
          text: lead.next_step ? NEXT_STEP_LABELS[lead.next_step] : "Next step",
          fontSize: 9,
          color: "#475569",
        },
        ...(lead.next_action
          ? [{ text: lead.next_action, fontSize: 10, margin: [0, 2, 0, 0] }]
          : []),
        ...(lead.owner_name.trim()
          ? [{ text: lead.owner_name.trim(), fontSize: 9, color: "#64748b", margin: [0, 2, 0, 0] }]
          : []),
      ]
      content.push({
        table: {
          widths: [22, "*"],
          body: [
            [
              {
                text: String(step),
                fillColor: color,
                color: "#ffffff",
                alignment: "center",
                bold: true,
                fontSize: 9,
                margin: [0, 5, 0, 5],
              },
              {
                stack: [
                  { text: `${time}   ${name}`, bold: true, fontSize: 11, color },
                  ...details,
                ],
                margin: [8, 2, 0, 2],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 0,
          paddingRight: () => 0,
          paddingTop: () => 2,
          paddingBottom: () => 2,
        },
        margin: [0, 0, 0, 6],
      })
      step += 1
    }
  }

  return {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 40],
    defaultStyle: { font: "Roboto", fontSize: 10, color: "#0f172a" },
    content,
  }
}

type PdfMakeClient = {
  addVirtualFileSystem?: (vfs: Record<string, string>) => void
  createPdf: (doc: Record<string, unknown>) => { download: (name: string) => Promise<void> }
}

export async function downloadLeadTimeline(leads: OrganizerLead[], today = todayDateKey()) {
  const pdfMakeModule = (await import("pdfmake/build/pdfmake")) as {
    default?: PdfMakeClient
  } & PdfMakeClient
  const vfsModule = (await import("pdfmake/build/vfs_fonts")) as {
    default?: Record<string, string>
  } & Record<string, string>
  const pdfMake = pdfMakeModule.default ?? pdfMakeModule
  const vfs = vfsModule.default ?? vfsModule
  pdfMake.addVirtualFileSystem?.(vfs)
  await pdfMake
    .createPdf(buildLeadTimelineDefinition(leads, today))
    .download("leads-next-3-days.pdf")
}

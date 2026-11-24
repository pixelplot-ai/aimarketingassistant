"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDeleteDialog } from "@/features/organizer/confirm-delete-dialog"
import {
  ACTIVITY_KIND_LABELS,
  DISQUALIFY_REASON_LABELS,
  DISQUALIFY_REASONS,
  LEAD_STAGE_LABELS,
  LEAD_STAGES,
  LEAD_TEMPERATURES,
  NEXT_STEP_LABELS,
  NEXT_STEPS,
  closeStepError,
  compareByNextStep,
  firstTouchOn,
  formatLeadDate,
  formatLeadWhen,
  isClosedStage,
  nextStepTiming,
  lastTouchOn,
  leadDisplayName,
  leadQueue,
  normalizeLeadTime,
  selectClassName,
  type CloseStepBody,
  type DisqualifyReason,
  type LeadQueue,
  type LeadTemperature,
  type NextStep,
  type NextStepTiming,
  type OrganizerLead,
} from "@/lib/organizer/leads"
import { todayDateKey } from "@/lib/organizer/tasks"
import { cn } from "@/lib/utils"

const QUEUE_LABELS: Record<LeadQueue, string> = {
  now: "Now",
  closed: "Closed",
}

const TIMING_STYLES: Record<NextStepTiming, string> = {
  overdue: "text-red-600 dark:text-red-400",
  today: "text-amber-600 dark:text-amber-400",
  upcoming: "text-emerald-600 dark:text-emerald-400",
  none: "text-muted-foreground",
}

const EVENT_STYLES: Record<Exclude<NextStepTiming, "none">, string> = {
  overdue: "bg-red-500/15 text-red-700 hover:bg-red-500/25 dark:text-red-300",
  today: "bg-amber-500/20 text-amber-900 hover:bg-amber-500/30 dark:text-amber-200",
  upcoming: "bg-emerald-500/15 text-emerald-800 hover:bg-emerald-500/25 dark:text-emerald-200",
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

type BoardTab = "now" | "calendar" | "closed"

const TEMPERATURE_STYLES: Record<LeadTemperature, string> = {
  hot: "bg-red-500/15 text-red-700 dark:text-red-300",
  warm: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  cold: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
}

const SECTION_TONES = {
  sky: {
    card: "border-sky-500/35 bg-sky-500/10",
    title: "text-sky-900 dark:text-sky-100",
    bar: "bg-sky-500",
  },
  violet: {
    card: "border-violet-500/35 bg-violet-500/10",
    title: "text-violet-900 dark:text-violet-100",
    bar: "bg-violet-500",
  },
  amber: {
    card: "border-amber-500/40 bg-amber-500/15",
    title: "text-amber-950 dark:text-amber-100",
    bar: "bg-amber-500",
  },
  emerald: {
    card: "border-emerald-500/35 bg-emerald-500/10",
    title: "text-emerald-900 dark:text-emerald-100",
    bar: "bg-emerald-500",
  },
  orange: {
    card: "border-orange-500/40 bg-orange-500/15",
    title: "text-orange-950 dark:text-orange-100",
    bar: "bg-orange-500",
  },
  indigo: {
    card: "border-indigo-500/35 bg-indigo-500/10",
    title: "text-indigo-900 dark:text-indigo-100",
    bar: "bg-indigo-500",
  },
} as const

type SectionTone = keyof typeof SECTION_TONES

export function LeadsBoard() {
  const [leads, setLeads] = useState<OrganizerLead[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<BoardTab>("now")
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [search, setSearch] = useState("")
  const [temperature, setTemperature] = useState("all")
  const [stage, setStage] = useState("all")
  const [owner, setOwner] = useState("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panelMode, setPanelMode] = useState<"view" | "details">("view")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  function openLead(id: string, mode: "view" | "details") {
    setPanelMode(mode)
    setSelectedId(id)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch("/api/organizer/leads")
        const data = (await response.json()) as {
          leads?: OrganizerLead[]
          error?: string
        }
        if (!response.ok) throw new Error(data.error || "Could not load leads")
        if (!cancelled) setLeads(data.leads ?? [])
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Failed to load")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const owners = useMemo(() => {
    const names = new Set<string>()
    for (const lead of leads) {
      if (lead.owner_name.trim()) names.add(lead.owner_name.trim())
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [leads])

  const narrowed = useMemo(() => {
    const query = search.trim().toLowerCase()
    return leads.filter((lead) => {
      if (temperature !== "all" && lead.temperature !== temperature) return false
      if (stage !== "all" && lead.stage !== stage) return false
      if (owner === "unassigned" && lead.owner_name.trim()) return false
      if (owner !== "all" && owner !== "unassigned" && lead.owner_name !== owner) {
        return false
      }
      if (!query) return true
      const haystack = [
        leadDisplayName(lead),
        lead.email,
        lead.phone,
        lead.company,
        lead.job_title,
        lead.notes,
        lead.next_action,
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [leads, owner, search, stage, temperature])

  const counts = useMemo(() => {
    const next: Record<LeadQueue, number> = { now: 0, closed: 0 }
    for (const lead of narrowed) next[leadQueue(lead)] += 1
    return next
  }, [narrowed])

  const calendarCount = useMemo(
    () => narrowed.filter((lead) => nextStepTiming(lead) !== "none").length,
    [narrowed],
  )

  const visible = useMemo(() => {
    if (tab === "calendar") return []
    return narrowed.filter((lead) => leadQueue(lead) === tab).sort(compareByNextStep)
  }, [narrowed, tab])

  const selected = leads.find((lead) => lead.id === selectedId) ?? null

  function replaceLead(updated: OrganizerLead) {
    setLeads((prev) => prev.map((lead) => (lead.id === updated.id ? updated : lead)))
  }

  async function createLead(body: Record<string, unknown>) {
    setSaving(true)
    try {
      const response = await fetch("/api/organizer/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await response.json()) as { lead?: OrganizerLead; error?: string }
      if (!response.ok || !data.lead) {
        throw new Error(data.error || "Could not create lead")
      }
      setLeads((prev) => [data.lead!, ...prev])
      setSelectedId(data.lead.id)
      setTab("now")
      setCreateOpen(false)
      toast.success("Lead added")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create lead")
    } finally {
      setSaving(false)
    }
  }

  async function saveLead(id: string, body: Record<string, unknown>) {
    setSaving(true)
    try {
      const response = await fetch(`/api/organizer/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await response.json()) as { lead?: OrganizerLead; error?: string }
      if (!response.ok || !data.lead) {
        throw new Error(data.error || "Could not save lead")
      }
      replaceLead(data.lead)
      const closed = body.closeStep as { mode?: string } | undefined
      toast.success(
        closed?.mode === "close"
          ? "Collaboration closed"
          : closed
            ? "Next step saved"
            : "Saved",
      )
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save lead")
      return false
    } finally {
      setSaving(false)
    }
  }

  async function removeLead(id: string) {
    setSaving(true)
    try {
      const response = await fetch(`/api/organizer/leads/${id}`, { method: "DELETE" })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error || "Could not delete lead")
      setLeads((prev) => prev.filter((lead) => lead.id !== id))
      setSelectedId(null)
      toast.success("Lead deleted")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete lead")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">Leads</h1>
          <p className="hidden text-sm text-muted-foreground sm:block">
            Open leads stay in Now, soonest next step first.
          </p>
        </div>
        <Button
          type="button"
          className="h-11 w-full sm:h-8 sm:w-auto"
          onClick={() => setCreateOpen(true)}
        >
          <PlusIcon />
          Add lead
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          className={cn(
            "inline-flex h-11 items-center gap-1.5 rounded-lg border px-3 text-sm lg:hidden",
            filtersOpen
              ? "border-foreground bg-foreground text-background"
              : "bg-card text-muted-foreground",
          )}
        >
          <SlidersHorizontalIcon className="size-4" />
          Filters
        </button>
        {(
          [
            ["now", "Now", counts.now],
            ["calendar", "Calendar", calendarCount],
            ["closed", "Closed", counts.closed],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              "h-11 rounded-lg border px-3 text-sm transition-colors lg:h-auto lg:py-1.5",
              tab === value
                ? "border-foreground bg-foreground text-background"
                : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            <span className="ml-2 tabular-nums">{count}</span>
          </button>
        ))}
      </div>

      <div
        className={cn(
          "gap-3 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end",
          filtersOpen ? "grid" : "hidden lg:flex",
        )}
      >
        <div className="space-y-1.5 sm:col-span-2 lg:min-w-48 lg:flex-1">
          <Label htmlFor="lead-search">Search</Label>
          <Input
            id="lead-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, company, email, phone"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-temperature">Temperature</Label>
          <select
            id="filter-temperature"
            value={temperature}
            onChange={(event) => setTemperature(event.target.value)}
            className={selectClassName}
          >
            <option value="all">All</option>
            {LEAD_TEMPERATURES.map((value) => (
              <option key={value} value={value}>
                {value[0]!.toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-stage">Stage</Label>
          <select
            id="filter-stage"
            value={stage}
            onChange={(event) => setStage(event.target.value)}
            className={selectClassName}
          >
            <option value="all">All</option>
            {LEAD_STAGES.map((value) => (
              <option key={value} value={value}>
                {LEAD_STAGE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-owner">Owner</Label>
          <select
            id="filter-owner"
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            className={selectClassName}
          >
            <option value="all">All</option>
            <option value="unassigned">Unassigned</option>
            {owners.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        {tab === "calendar" ? (
          loading ? (
            <div className="flex min-h-0 min-w-0 flex-1 items-center gap-2 rounded-xl border bg-card p-6 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Loading leads
            </div>
          ) : (
            <LeadCalendar
              leads={narrowed}
              month={month}
              selectedId={selectedId}
              onMonth={setMonth}
              onSelect={(id) => openLead(id, "view")}
            />
          )
        ) : (
        <div className="min-w-0 flex-1 overflow-auto rounded-xl border bg-card">
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Loading leads
            </div>
          ) : visible.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Nothing in {QUEUE_LABELS[tab]}.
            </p>
          ) : (
            <>
            <ul className="divide-y md:hidden">
              {visible.map((lead) => {
                const timing = nextStepTiming(lead)
                return (
                  <li
                    key={lead.id}
                    className={cn(
                      "flex items-stretch",
                      selectedId === lead.id && "bg-muted/60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => openLead(lead.id, "view")}
                      className="flex min-w-0 flex-1 flex-col gap-1 px-3 py-3 text-left"
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-medium">{leadDisplayName(lead)}</span>
                        {lead.temperature ? (
                          <span
                            className={cn(
                              "shrink-0 rounded-md px-1.5 py-0.5 text-xs capitalize",
                              TEMPERATURE_STYLES[lead.temperature],
                            )}
                          >
                            {lead.temperature}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {[lead.job_title, lead.company].filter(Boolean).join(" · ") ||
                          "No company"}
                      </span>
                      <span className="text-xs">
                        {LEAD_STAGE_LABELS[lead.stage]}
                        {" · "}
                        {lead.next_step ? NEXT_STEP_LABELS[lead.next_step] : "No next step"}
                        {" "}
                        <span className={TIMING_STYLES[timing]}>
                          {formatLeadWhen(lead.next_action_on, lead.next_action_time)}
                        </span>
                      </span>
                      {lead.next_action ? (
                        <span className="text-xs text-muted-foreground">
                          {lead.next_action}
                        </span>
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        {lead.owner_name || "Unassigned"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openLead(lead.id, "details")}
                      className="flex w-16 shrink-0 flex-col items-center justify-center gap-1 border-l text-xs font-medium"
                    >
                      <PencilIcon className="size-4" />
                      Edit
                    </button>
                  </li>
                )
              })}
            </ul>
            <table className="hidden w-full min-w-[860px] border-collapse text-sm md:table">
              <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-3 py-2 font-medium">Person</th>
                  <th className="px-3 py-2 font-medium">Company</th>
                  <th className="px-3 py-2 font-medium">Temp</th>
                  <th className="px-3 py-2 font-medium">Stage</th>
                  <th className="px-3 py-2 font-medium">Next step</th>
                  <th className="px-3 py-2 font-medium">Owner</th>
                  <th className="px-3 py-2 font-medium">First touch</th>
                  <th className="px-3 py-2 font-medium">Last touch</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((lead) => {
                  const timing = nextStepTiming(lead)
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => openLead(lead.id, "view")}
                      className={cn(
                        "cursor-pointer border-b last:border-b-0 hover:bg-muted/40",
                        selectedId === lead.id && "bg-muted/60",
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{leadDisplayName(lead)}</div>
                        <div className="text-xs text-muted-foreground">
                          {lead.job_title || "—"}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">{lead.company || "—"}</td>
                      <td className="px-3 py-2.5">
                        {lead.temperature ? (
                          <span
                            className={cn(
                              "rounded-md px-1.5 py-0.5 text-xs capitalize",
                              TEMPERATURE_STYLES[lead.temperature],
                            )}
                          >
                            {lead.temperature}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5">{LEAD_STAGE_LABELS[lead.stage]}</td>
                      <td className="max-w-56 px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span>
                            {lead.next_step ? NEXT_STEP_LABELS[lead.next_step] : "—"}
                          </span>
                          <span className={cn("text-xs", TIMING_STYLES[timing])}>
                            {formatLeadWhen(lead.next_action_on, lead.next_action_time)}
                          </span>
                        </div>
                        {lead.next_action ? (
                          <div className="truncate text-xs text-muted-foreground">
                            {lead.next_action}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5">{lead.owner_name || "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {formatLeadDate(firstTouchOn(lead))}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {formatLeadDate(lastTouchOn(lead))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </>
          )}
        </div>
        )}

        {selected ? (
          <LeadPanel
            key={`${selected.id}:${selected.updated_at}:${panelMode}`}
            lead={selected}
            startMode={panelMode}
            saving={saving}
            onClose={() => setSelectedId(null)}
            onSave={(body) => saveLead(selected.id, body)}
            onDelete={() => removeLead(selected.id)}
          />
        ) : null}
      </div>

      {createOpen ? (
        <CreateLeadDialog
          saving={saving}
          onClose={() => setCreateOpen(false)}
          onCreate={createLead}
        />
      ) : null}
    </div>
  )
}

function buildMonthCells(month: Date): { key: string; inMonth: boolean; day: number }[] {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const total = Math.ceil((firstWeekday + daysInMonth) / 7) * 7
  const cursor = new Date(year, monthIndex, 1 - firstWeekday)
  return Array.from({ length: total }, (_, index) => {
    const date = new Date(cursor)
    date.setDate(cursor.getDate() + index)
    return {
      key: todayDateKey(date),
      inMonth: date.getMonth() === monthIndex,
      day: date.getDate(),
    }
  })
}

function LeadCalendar({
  leads,
  month,
  selectedId,
  onMonth,
  onSelect,
}: {
  leads: OrganizerLead[]
  month: Date
  selectedId: string | null
  onMonth: (month: Date) => void
  onSelect: (id: string) => void
}) {
  const [exporting, setExporting] = useState(false)
  const today = todayDateKey()
  const cells = useMemo(() => buildMonthCells(month), [month])
  const byDay = useMemo(() => {
    const map = new Map<string, OrganizerLead[]>()
    for (const lead of leads) {
      if (!lead.next_action_on || nextStepTiming(lead) === "none") continue
      const list = map.get(lead.next_action_on) ?? []
      list.push(lead)
      map.set(lead.next_action_on, list)
    }
    for (const list of map.values()) list.sort(compareByNextStep)
    return map
  }, [leads])
  const label = month.toLocaleDateString(undefined, { month: "long", year: "numeric" })

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-2 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          aria-label="Previous month"
        >
          <ChevronLeftIcon />
        </Button>
        <p className="min-w-0 flex-1 text-center text-sm font-medium">{label}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          aria-label="Next month"
        >
          <ChevronRightIcon />
        </Button>
        <div className="flex w-full justify-center gap-2 sm:w-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const now = new Date()
              onMonth(new Date(now.getFullYear(), now.getMonth(), 1))
            }}
          >
            Today
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={exporting}
            onClick={() => {
              setExporting(true)
              void import("@/lib/organizer/lead-timeline-pdf")
                .then(({ downloadLeadTimeline }) => downloadLeadTimeline(leads))
                .catch((err: unknown) => {
                  toast.error(err instanceof Error ? err.message : "Could not export the PDF")
                })
                .finally(() => setExporting(false))
            }}
          >
            {exporting ? <Loader2Icon className="animate-spin" /> : null}
            Export PDF
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b text-[10px] text-muted-foreground sm:text-xs">
        {WEEKDAYS.map((day) => (
          <div key={day} className="px-0.5 py-1.5 text-center font-medium sm:px-2">
            {day}
          </div>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="grid min-h-full grid-cols-7">
          {cells.map((cell) => {
            const events = byDay.get(cell.key) ?? []
            const isToday = cell.key === today
            return (
              <div
                key={cell.key}
                className={cn(
                  "min-h-16 border-r border-b p-0.5 last:border-r-0 sm:min-h-28 sm:p-1",
                  !cell.inMonth && "bg-muted/30",
                  isToday && "ring-1 ring-sky-300 ring-inset dark:ring-sky-400/70",
                )}
              >
                <div
                  className={cn(
                    "mb-1 px-1 text-xs",
                    cell.inMonth ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {cell.day}
                </div>
                <div className="space-y-1">
                  {events.map((lead) => {
                    const timing = nextStepTiming(lead)
                    if (timing === "none") return null
                    const time = normalizeLeadTime(lead.next_action_time)
                    const company = lead.company.trim()
                    const label = company
                      ? `${leadDisplayName(lead)} (${company})`
                      : leadDisplayName(lead)
                    return (
                      <button
                        key={lead.id}
                        type="button"
                        title={`${label}${lead.next_step ? ` · ${NEXT_STEP_LABELS[lead.next_step]}` : ""}${lead.next_action ? ` · ${lead.next_action}` : ""}`}
                        onClick={() => onSelect(lead.id)}
                        className={cn(
                          "block w-full truncate rounded px-1 py-0.5 text-left text-[11px] leading-4",
                          EVENT_STYLES[timing],
                          selectedId === lead.id && "ring-1 ring-foreground",
                        )}
                      >
                        {time ? `${time} ` : ""}
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function displayPhone(phone: string): string {
  return phone.startsWith("40") ? `+${phone}` : phone
}

function LeadPanel({
  lead,
  startMode = "view",
  saving,
  onClose,
  onSave,
  onDelete,
}: {
  lead: OrganizerLead
  startMode?: "view" | "details"
  saving: boolean
  onClose: () => void
  onSave: (body: Record<string, unknown>) => Promise<boolean>
  onDelete: () => Promise<void>
}) {
  const closed = isClosedStage(lead.stage)
  const timing = nextStepTiming(lead)
  const [mode, setMode] = useState<"view" | "details" | "step" | "close">(startMode)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [firstName, setFirstName] = useState(lead.first_name)
  const [lastName, setLastName] = useState(lead.last_name)
  const [email, setEmail] = useState(lead.email)
  const [phone, setPhone] = useState(lead.phone)
  const [company, setCompany] = useState(lead.company)
  const [jobTitle, setJobTitle] = useState(lead.job_title)
  const [ownerName, setOwnerName] = useState(lead.owner_name)
  const [temperature, setTemperature] = useState(lead.temperature ?? "")
  const [notes, setNotes] = useState(lead.notes)
  const [follow, setFollow] = useState<"next" | "close">("next")
  const [outcome, setOutcome] = useState("")
  const [happenedOn, setHappenedOn] = useState(todayDateKey())
  const [nextStep, setNextStep] = useState<NextStep>(lead.next_step ?? "email")
  const [nextActionOn, setNextActionOn] = useState(lead.next_action_on ?? "")
  const [nextActionTime, setNextActionTime] = useState(
    lead.next_action_time?.slice(0, 5) ?? "",
  )
  const [nextAction, setNextAction] = useState(lead.next_action)
  const [closeStage, setCloseStage] = useState<"qualified" | "disqualified">("qualified")
  const [reason, setReason] = useState<DisqualifyReason | "">("")

  const history = showAllHistory ? lead.activities : lead.activities.slice(0, 4)
  const hiddenHistory = Math.max(0, lead.activities.length - history.length)

  function openClose() {
    setFollow("next")
    setOutcome("")
    setHappenedOn(todayDateKey())
    setNextStep("email")
    setNextActionOn("")
    setNextActionTime("")
    setNextAction("")
    setCloseStage("qualified")
    setReason("")
    setMode("close")
  }

  function openEditStep() {
    setNextStep(lead.next_step ?? "email")
    setNextActionOn(lead.next_action_on ?? "")
    setNextActionTime(lead.next_action_time?.slice(0, 5) ?? "")
    setNextAction(lead.next_action)
    setMode("step")
  }

  return (
    <>
    <button
      type="button"
      className="fixed inset-0 z-30 bg-black/40 lg:hidden"
      aria-label="Close lead"
      onClick={onClose}
    />
    <aside className="flex w-full max-w-lg shrink-0 flex-col overflow-auto rounded-xl border bg-card max-lg:fixed max-lg:inset-0 max-lg:z-40 max-lg:max-w-none max-lg:rounded-none max-lg:pt-[env(safe-area-inset-top)] max-lg:pb-[env(safe-area-inset-bottom)]">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-card p-4">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-semibold tracking-tight">
            {[lead.salutation, leadDisplayName(lead)].filter(Boolean).join(" ")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {LEAD_STAGE_LABELS[lead.stage]}
            {lead.company ? ` · ${lead.company}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {mode === "view" ? (
            <Button
              type="button"
              className="h-11 px-4 sm:h-8"
              onClick={() => setMode("details")}
            >
              <PencilIcon />
              Edit
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-11 sm:size-7"
            onClick={onClose}
            aria-label="Close"
          >
            <XIcon />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-3">
      <section className="space-y-2">
        <div className="px-0.5">
          <h3 className="text-sm font-semibold">Details</h3>
        </div>
        {mode === "details" ? (
          <form
            className="space-y-3 rounded-xl border border-sky-500/35 bg-sky-500/10 p-3"
            onSubmit={(event) => {
              event.preventDefault()
              void onSave({
                firstName,
                lastName,
                email,
                phone,
                company,
                jobTitle,
                ownerName,
                temperature: temperature || null,
                notes,
              })
            }}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="lead-first">First name</Label>
                <Input
                  id="lead-first"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  disabled={saving}
                  autoComplete="given-name"
                  className="h-11 md:h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-last">Last name</Label>
                <Input
                  id="lead-last"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  disabled={saving}
                  autoComplete="family-name"
                  className="h-11 md:h-8"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-email">Email</Label>
              <Input
                id="lead-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={saving}
                className="h-11 md:h-8"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-phone">Phone</Label>
              <Input
                id="lead-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                disabled={saving}
                className="h-11 md:h-8"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="lead-company">Company</Label>
                <Input
                  id="lead-company"
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  disabled={saving}
                  autoComplete="organization"
                  className="h-11 md:h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-title">Job title</Label>
                <Input
                  id="lead-title"
                  value={jobTitle}
                  onChange={(event) => setJobTitle(event.target.value)}
                  disabled={saving}
                  autoComplete="organization-title"
                  className="h-11 md:h-8"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="lead-owner">Owner</Label>
                <Input
                  id="lead-owner"
                  value={ownerName}
                  onChange={(event) => setOwnerName(event.target.value)}
                  disabled={saving}
                  className="h-11 md:h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-temperature">Temperature</Label>
                <select
                  id="lead-temperature"
                  value={temperature}
                  onChange={(event) => setTemperature(event.target.value)}
                  className={selectClassName}
                  disabled={saving}
                >
                  <option value="">Unset</option>
                  {LEAD_TEMPERATURES.map((value) => (
                    <option key={value} value={value}>
                      {value[0]!.toUpperCase() + value.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-notes">Booth note</Label>
              <Textarea
                id="lead-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                disabled={saving}
                className="text-base md:text-sm"
              />
            </div>
            <div className="sticky bottom-0 z-10 -mx-3 flex flex-col-reverse gap-2 border-t border-sky-500/20 bg-sky-500/10 px-3 py-3 sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
              <Button
                type="button"
                variant="outline"
                className="h-11 sm:h-8"
                disabled={saving}
                onClick={() => setMode("view")}
              >
                Cancel
              </Button>
              <Button type="submit" className="h-11 sm:h-8" disabled={saving}>
                {saving ? <Loader2Icon className="animate-spin" /> : null}
                Save
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-2">
            <DetailGroup title="Contact" tone="sky">
              <dl className="space-y-1.5">
              <DetailLine label="Email">
                {lead.email ? (
                  <a className="underline-offset-2 hover:underline" href={`mailto:${lead.email}`}>
                    {lead.email}
                  </a>
                ) : (
                  "—"
                )}
              </DetailLine>
              <DetailLine label="Phone">
                {lead.phone ? (
                  <a
                    className="underline-offset-2 hover:underline"
                    href={`tel:${displayPhone(lead.phone)}`}
                  >
                    {displayPhone(lead.phone)}
                  </a>
                ) : (
                  "—"
                )}
              </DetailLine>
              </dl>
            </DetailGroup>
            <DetailGroup title="Company" tone="violet">
              <dl className="space-y-1.5">
              <DetailLine label="Company">{lead.company || "—"}</DetailLine>
              <DetailLine label="Job title">{lead.job_title || "—"}</DetailLine>
              {lead.job_function ? (
                <DetailLine label="Function">{lead.job_function}</DetailLine>
              ) : null}
              {lead.industry ? <DetailLine label="Industry">{lead.industry}</DetailLine> : null}
              {lead.country ? <DetailLine label="Country">{lead.country}</DetailLine> : null}
              {lead.turnover_band ? (
                <DetailLine label="Turnover">{lead.turnover_band}</DetailLine>
              ) : null}
              {lead.employee_band ? (
                <DetailLine label="Employees">{lead.employee_band}</DetailLine>
              ) : null}
              </dl>
            </DetailGroup>
            <DetailGroup title="Status" tone="amber">
              <dl className="space-y-1.5">
              {lead.temperature ? (
                <DetailLine label="Temperature">
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-xs capitalize",
                      TEMPERATURE_STYLES[lead.temperature],
                    )}
                  >
                    {lead.temperature}
                  </span>
                </DetailLine>
              ) : (
                <DetailLine label="Temperature">—</DetailLine>
              )}
              <DetailLine label="Owner">{lead.owner_name || "—"}</DetailLine>
              {lead.scanned_at || lead.scanned_by ? (
                <DetailLine label="Scanned">
                  {lead.scanned_at
                    ? `${formatLeadDate(lead.scanned_at)}${lead.scanned_by ? ` · ${lead.scanned_by}` : ""}`
                    : lead.scanned_by}
                </DetailLine>
              ) : null}
              </dl>
            </DetailGroup>
            <DetailGroup title="Note" tone="emerald">
              <p className="text-sm whitespace-pre-wrap">{lead.notes || "—"}</p>
            </DetailGroup>
          </div>
        )}
      </section>

      <section className={cn("space-y-3 rounded-xl border p-3.5", SECTION_TONES.orange.card)}>
        <h3 className={cn("flex items-center gap-2 text-sm font-semibold", SECTION_TONES.orange.title)}>
          <span className={cn("h-4 w-1 shrink-0 rounded-full", SECTION_TONES.orange.bar)} aria-hidden />
          Next step
        </h3>
        {closed ? (
          <p className="text-sm text-muted-foreground">
            Collaboration closed
            {lead.stage === "disqualified" && lead.disqualify_reason
              ? ` · ${DISQUALIFY_REASON_LABELS[lead.disqualify_reason]}`
              : ""}
            .
          </p>
        ) : (
          <>
            <div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">
                  {lead.next_step ? NEXT_STEP_LABELS[lead.next_step] : "—"}
                </span>
                <span className={TIMING_STYLES[timing]}>
                  {formatLeadWhen(lead.next_action_on, lead.next_action_time)}
                </span>
              </div>
              {lead.next_action ? <p className="mt-1 text-sm">{lead.next_action}</p> : null}
            </div>
            {mode === "view" ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={saving} onClick={openClose}>
                  Mark done
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={openEditStep}
                >
                  Edit
                </Button>
              </div>
            ) : null}
            {mode === "step" ? (
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (!nextAction.trim()) {
                    toast.error("Write the next step")
                    return
                  }
                  void onSave({
                    nextStep,
                    nextActionOn: nextActionOn || null,
                    nextActionTime: nextActionTime || null,
                    nextAction: nextAction.trim(),
                  })
                }}
              >
                <StepFields
                  nextStep={nextStep}
                  nextActionOn={nextActionOn}
                  nextActionTime={nextActionTime}
                  nextAction={nextAction}
                  saving={saving}
                  onStep={setNextStep}
                  onDate={setNextActionOn}
                  onTime={setNextActionTime}
                  onAction={setNextAction}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => setMode("view")}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2Icon className="animate-spin" /> : null}
                    Save
                  </Button>
                </div>
              </form>
            ) : null}
            {mode === "close" ? (
              <form
                className="space-y-4 rounded-lg border bg-muted/30 p-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  const payload: CloseStepBody =
                    follow === "close"
                      ? {
                          mode: "close",
                          outcome: outcome.trim(),
                          happenedOn: happenedOn || undefined,
                          stage: closeStage,
                          disqualifyReason:
                            closeStage === "disqualified" ? reason || null : null,
                        }
                      : {
                          mode: "next",
                          outcome: outcome.trim(),
                          happenedOn: happenedOn || undefined,
                          nextStep,
                          nextActionOn: nextActionOn || null,
                          nextActionTime: nextActionTime || null,
                          nextAction: nextAction.trim(),
                        }
                  const problem = closeStepError(payload)
                  if (problem) {
                    toast.error(problem)
                    return
                  }
                  void onSave({ closeStep: payload })
                }}
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">1. Log this step</p>
                  <p className="text-xs text-muted-foreground">
                    This is saved in history. The step above is the one you are finishing.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="step-outcome">What happened</Label>
                  <Textarea
                    id="step-outcome"
                    value={outcome}
                    onChange={(event) => setOutcome(event.target.value)}
                    rows={2}
                    placeholder="They replied, no answer, meeting done…"
                    disabled={saving}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="step-happened">Done on</Label>
                  <Input
                    id="step-happened"
                    type="date"
                    value={happenedOn}
                    onChange={(event) => setHappenedOn(event.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">2. What follows</p>
                    <p className="text-xs text-muted-foreground">
                      Schedule another step, or end the collaboration.
                    </p>
                  </div>
                  <div
                    className={cn(
                      "space-y-3 rounded-lg border bg-background p-3",
                      follow === "next" ? "border-foreground" : "border-border",
                    )}
                  >
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 text-left"
                      aria-pressed={follow === "next"}
                      onClick={() => setFollow("next")}
                    >
                      <ChoiceMark selected={follow === "next"} />
                      <span>
                        <span className="block text-sm font-medium">Schedule the next step</span>
                        <span className="block text-xs text-muted-foreground">
                          The lead stays open.
                        </span>
                      </span>
                    </button>
                    {follow === "next" ? (
                      <StepFields
                        nextStep={nextStep}
                        nextActionOn={nextActionOn}
                        nextActionTime={nextActionTime}
                        nextAction={nextAction}
                        saving={saving}
                        onStep={setNextStep}
                        onDate={setNextActionOn}
                        onTime={setNextActionTime}
                        onAction={setNextAction}
                      />
                    ) : null}
                  </div>
                  <div
                    className={cn(
                      "space-y-3 rounded-lg border bg-background p-3",
                      follow === "close" ? "border-foreground" : "border-border",
                    )}
                  >
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 text-left"
                      aria-pressed={follow === "close"}
                      onClick={() => setFollow("close")}
                    >
                      <ChoiceMark selected={follow === "close"} />
                      <span>
                        <span className="block text-sm font-medium">End the collaboration</span>
                        <span className="block text-xs text-muted-foreground">
                          No further step. Mark qualified or disqualified.
                        </span>
                      </span>
                    </button>
                    {follow === "close" ? (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="close-stage">Mark as</Label>
                          <select
                            id="close-stage"
                            value={closeStage}
                            onChange={(event) =>
                              setCloseStage(
                                event.target.value as "qualified" | "disqualified",
                              )
                            }
                            className={selectClassName}
                            disabled={saving}
                          >
                            <option value="qualified">Qualified</option>
                            <option value="disqualified">Disqualified</option>
                          </select>
                        </div>
                        {closeStage === "disqualified" ? (
                          <div className="space-y-1.5">
                            <Label htmlFor="close-reason">Reason</Label>
                            <select
                              id="close-reason"
                              value={reason}
                              onChange={(event) =>
                                setReason(event.target.value as DisqualifyReason)
                              }
                              className={selectClassName}
                              disabled={saving}
                            >
                              <option value="">Select a reason</option>
                              {DISQUALIFY_REASONS.map((value) => (
                                <option key={value} value={value}>
                                  {DISQUALIFY_REASON_LABELS[value]}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => setMode("view")}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2Icon className="animate-spin" /> : null}
                    {follow === "close" ? "End collaboration" : "Save and schedule"}
                  </Button>
                </div>
              </form>
            ) : null}
          </>
        )}
      </section>

      <section className={cn("space-y-3 rounded-xl border p-3.5", SECTION_TONES.indigo.card)}>
        <h3 className={cn("flex items-center gap-2 text-sm font-semibold", SECTION_TONES.indigo.title)}>
          <span className={cn("h-4 w-1 shrink-0 rounded-full", SECTION_TONES.indigo.bar)} aria-hidden />
          History
        </h3>
        {lead.activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No history yet.</p>
        ) : (
          <ol className="space-y-3">
            {history.map((activity) => (
              <li key={activity.id} className="border-l-2 border-indigo-500/50 pl-2.5 text-sm">
                <div className="text-xs text-muted-foreground">
                  {formatLeadDate(activity.happened_on)} · {ACTIVITY_KIND_LABELS[activity.kind]}
                  {activity.author ? ` · ${activity.author}` : ""}
                </div>
                <p className="line-clamp-2">{activity.body}</p>
              </li>
            ))}
          </ol>
        )}
        {hiddenHistory > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAllHistory(true)}
          >
            Show the rest ({hiddenHistory})
          </Button>
        ) : null}
      </section>

      <div>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          className="text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2Icon />
          Delete
        </Button>
      </div>
      </div>

      {confirmDelete ? (
        <ConfirmDeleteDialog
          title={`Delete ${leadDisplayName(lead)}?`}
          saving={saving}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            void onDelete()
          }}
        />
      ) : null}
    </aside>
    </>
  )
}

function ChoiceMark({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
        selected ? "border-foreground" : "border-muted-foreground",
      )}
      aria-hidden
    >
      {selected ? <span className="size-2 rounded-full bg-foreground" /> : null}
    </span>
  )
}

function DetailGroup({
  title,
  tone,
  children,
}: {
  title: string
  tone: SectionTone
  children: ReactNode
}) {
  const toneStyle = SECTION_TONES[tone]
  return (
    <div className={cn("space-y-2 rounded-xl border px-3 py-2.5", toneStyle.card)}>
      <p
        className={cn(
          "flex items-center gap-2 text-[11px] font-semibold tracking-wide uppercase",
          toneStyle.title,
        )}
      >
        <span className={cn("h-3.5 w-1 shrink-0 rounded-full", toneStyle.bar)} aria-hidden />
        {title}
      </p>
      {children}
    </div>
  )
}

function DetailLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-0.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

function StepFields({
  nextStep,
  nextActionOn,
  nextActionTime,
  nextAction,
  saving,
  onStep,
  onDate,
  onTime,
  onAction,
}: {
  nextStep: NextStep
  nextActionOn: string
  nextActionTime: string
  nextAction: string
  saving: boolean
  onStep: (value: NextStep) => void
  onDate: (value: string) => void
  onTime: (value: string) => void
  onAction: (value: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="lead-next-step">Type</Label>
        <select
          id="lead-next-step"
          value={nextStep}
          onChange={(event) => onStep(event.target.value as NextStep)}
          className={selectClassName}
          disabled={saving}
        >
          {NEXT_STEPS.map((value) => (
            <option key={value} value={value}>
              {NEXT_STEP_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="lead-next-date">Due</Label>
          <Input
            id="lead-next-date"
            type="date"
            value={nextActionOn}
            onChange={(event) => onDate(event.target.value)}
            disabled={saving}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lead-next-time">Time</Label>
          <Input
            id="lead-next-time"
            type="time"
            step={60}
            value={nextActionTime}
            onChange={(event) => onTime(event.target.value)}
            disabled={saving}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-next-action">What happens next</Label>
        <Input
          id="lead-next-action"
          value={nextAction}
          onChange={(event) => onAction(event.target.value)}
          disabled={saving}
        />
      </div>
    </div>
  )
}

function CreateLeadDialog({
  saving,
  onClose,
  onCreate,
}: {
  saving: boolean
  onClose: () => void
  onCreate: (body: Record<string, unknown>) => Promise<void>
}) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [company, setCompany] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [temperature, setTemperature] = useState<LeadTemperature | "">("warm")
  const [notes, setNotes] = useState("")

  return (
    <div className="fixed inset-0 z-50 flex sm:items-center sm:justify-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-lead-title"
        className="relative z-10 flex h-dvh w-full flex-col bg-background pt-[env(safe-area-inset-top)] sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-md sm:rounded-xl sm:border sm:pt-0 sm:shadow-lg"
        onSubmit={(event) => {
          event.preventDefault()
          void onCreate({
            firstName,
            lastName,
            email,
            phone,
            company,
            jobTitle,
            temperature: temperature || null,
            notes,
            nextStep: "email",
            nextAction: "First follow-up",
          })
        }}
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 id="add-lead-title" className="text-lg font-semibold tracking-tight">
            Add lead
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-11 sm:size-7"
            onClick={onClose}
            aria-label="Close"
          >
            <XIcon />
          </Button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-first">First name</Label>
            <Input
              id="new-first"
              value={firstName}
              autoComplete="given-name"
              className="h-11 md:h-8"
              onChange={(event) => setFirstName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-last">Last name</Label>
            <Input
              id="new-last"
              value={lastName}
              autoComplete="family-name"
              className="h-11 md:h-8"
              onChange={(event) => setLastName(event.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-email">Email</Label>
          <Input
            id="new-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            className="h-11 md:h-8"
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-phone">Phone</Label>
          <Input
            id="new-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            className="h-11 md:h-8"
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-company">Company</Label>
            <Input
              id="new-company"
              value={company}
              autoComplete="organization"
              className="h-11 md:h-8"
              onChange={(event) => setCompany(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-temp">Temperature</Label>
            <select
              id="new-temp"
              value={temperature}
              onChange={(event) =>
                setTemperature(event.target.value as LeadTemperature)
              }
              className={selectClassName}
            >
              {LEAD_TEMPERATURES.map((value) => (
                <option key={value} value={value}>
                  {value[0]!.toUpperCase() + value.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-title">Job title</Label>
          <Input
            id="new-title"
            value={jobTitle}
            autoComplete="organization-title"
            className="h-11 md:h-8"
            onChange={(event) => setJobTitle(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-notes">Note</Label>
          <Textarea
            id="new-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="text-base md:text-sm"
          />
        </div>
        </div>
        <div className="flex gap-2 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 sm:h-8 sm:flex-none"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="h-11 flex-1 sm:h-8 sm:flex-none"
            disabled={
              saving || (!firstName.trim() && !lastName.trim() && !email.trim())
            }
          >
            {saving ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
            Create
          </Button>
        </div>
      </form>
    </div>
  )
}

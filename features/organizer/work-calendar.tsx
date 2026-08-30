"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  formatDayHeader,
  formatHourLabel,
  formatRangeLabel,
  getDayHours,
  getInitials,
  getVisibleDays,
  hoursBetweenInclusive,
  isSlotLocked,
  LANE_STYLES,
  sameLocalDay,
  slotKey,
  ROSTER_LIMIT,
  type SchedulePerson,
  type WorkSlotRow,
} from "@/lib/organizer/schedule"
import { cn } from "@/lib/utils"

const WINDOW_STEP_DAYS = 1
const SLIDE_MS = 320

type DraftState = {
  dayKey: string
  laneIndex: number
  userId: string
  anchor: Date
  end: Date
  mode: "set" | "clear"
}

type LaneSlot =
  | { kind: "person"; person: SchedulePerson }
  | { kind: "placeholder"; laneIndex: number }

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function toHourIso(date: Date): string {
  return date.toISOString()
}

function buildLanes(roster: SchedulePerson[]): LaneSlot[] {
  return Array.from({ length: ROSTER_LIMIT }, (_, laneIndex) => {
    const person = roster.find((p) => p.laneIndex === laneIndex)
    if (person) return { kind: "person" as const, person }
    return { kind: "placeholder" as const, laneIndex }
  })
}

function isToday(day: Date, now: Date): boolean {
  return sameLocalDay(day, now)
}

interface WorkCalendarProps {
  currentUserId: string
}

export function WorkCalendar({ currentUserId }: WorkCalendarProps) {
  const [roster, setRoster] = useState<SchedulePerson[]>([])
  const [slotSet, setSlotSet] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hover, setHover] = useState<{
    dayKey: string
    laneIndex: number
    hour: number
  } | null>(null)
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [windowOffsetDays, setWindowOffsetDays] = useState(0)
  const [sliding, setSliding] = useState(false)
  const slideTrackRef = useRef<HTMLDivElement>(null)
  const pointerSelectingRef = useRef(false)
  const draftRef = useRef<DraftState | null>(null)
  const commitDraftRef = useRef<(next: DraftState) => Promise<void>>(async () => {})

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  const calendarDayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`

  const days = useMemo(() => {
    const anchor = new Date(now)
    anchor.setHours(12, 0, 0, 0)
    return getVisibleDays(anchor, windowOffsetDays)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roll on calendar day or window shift
  }, [calendarDayKey, windowOffsetDays])

  const rangeLabel = useMemo(
    () => formatRangeLabel(days[0]!, days[days.length - 1]!),
    [days],
  )

  const rangeFromIso = useMemo(() => {
    const d = new Date(days[0]!)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }, [days])

  const rangeToIso = useMemo(() => {
    const d = new Date(days[days.length - 1]!)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + 1)
    return d.toISOString()
  }, [days])

  const myLane = useMemo(
    () => roster.find((p) => p.id === currentUserId) ?? null,
    [roster, currentUserId],
  )

  const lanes = useMemo(() => buildLanes(roster), [roster])
  const hasLoadedRef = useRef(false)
  const currentHour = now.getHours()

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    async function loadSchedule() {
      if (!hasLoadedRef.current) {
        setLoading(true)
      }
      try {
        const params = new URLSearchParams({
          from: rangeFromIso,
          to: rangeToIso,
        })
        const response = await fetch(`/api/organizer/schedule?${params}`, {
          signal: controller.signal,
        })
        const data = (await response.json()) as {
          roster?: SchedulePerson[]
          slots?: WorkSlotRow[]
          error?: string
        }
        if (!response.ok) {
          throw new Error(data.error || "Could not load schedule")
        }
        if (cancelled) return
        setRoster(data.roster ?? [])
        const next = new Set<string>()
        for (const slot of data.slots ?? []) {
          next.add(slotKey(slot.user_id, new Date(slot.starts_at).toISOString()))
        }
        setSlotSet(next)
        hasLoadedRef.current = true
      } catch (err) {
        if (cancelled || (err instanceof Error && err.name === "AbortError")) {
          return
        }
        toast.error(err instanceof Error ? err.message : "Failed to load")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadSchedule()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [rangeFromIso, rangeToIso])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        pointerSelectingRef.current = false
        setDraft(null)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    function onPointerUp() {
      if (!pointerSelectingRef.current) return
      pointerSelectingRef.current = false
      const current = draftRef.current
      if (!current) return
      void commitDraftRef.current(current)
    }
    window.addEventListener("pointerup", onPointerUp)
    window.addEventListener("pointercancel", onPointerUp)
    return () => {
      window.removeEventListener("pointerup", onPointerUp)
      window.removeEventListener("pointercancel", onPointerUp)
    }
  }, [])

  const draftHours = useMemo(() => {
    if (!draft) return new Set<string>()
    return new Set(
      hoursBetweenInclusive(draft.anchor, draft.end).map((d) => toHourIso(d)),
    )
  }, [draft])

  async function commitDraft(next: DraftState) {
    const hours = hoursBetweenInclusive(next.anchor, next.end)
    if (hours.length === 0) {
      setDraft(null)
      return
    }
    if (hours.some((h) => isSlotLocked(h, now))) {
      toast.error("Cannot modify slots more than 48 hours in the past")
      setDraft(null)
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/organizer/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: hours.map((h) => toHourIso(h)),
          mode: next.mode,
        }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Could not save schedule")
      }

      setSlotSet((prev) => {
        const copy = new Set(prev)
        for (const h of hours) {
          const key = slotKey(next.userId, toHourIso(h))
          if (next.mode === "set") copy.add(key)
          else copy.delete(key)
        }
        return copy
      })
      setDraft(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
      setDraft(null)
    } finally {
      setSaving(false)
    }
  }

  commitDraftRef.current = commitDraft

  function startSelection(person: SchedulePerson, hour: Date) {
    if (saving || sliding) return
    if (person.id !== currentUserId) return
    if (isSlotLocked(hour, now)) return

    const occupied = slotSet.has(slotKey(person.id, toHourIso(hour)))
    const next: DraftState = {
      dayKey: dayKey(hour),
      laneIndex: person.laneIndex,
      userId: person.id,
      anchor: hour,
      end: hour,
      mode: occupied ? "clear" : "set",
    }
    pointerSelectingRef.current = true
    draftRef.current = next
    setDraft(next)
  }

  function extendSelection(person: SchedulePerson, hour: Date) {
    if (!pointerSelectingRef.current) return
    const current = draftRef.current
    if (!current) return
    if (person.id !== current.userId) return
    if (person.laneIndex !== current.laneIndex) return
    if (!sameLocalDay(current.anchor, hour)) return
    if (isSlotLocked(hour, now)) return

    const next = { ...current, end: hour }
    draftRef.current = next
    setDraft(next)
  }

  function handleCellEnter(person: SchedulePerson, hour: Date) {
    setHover({
      dayKey: dayKey(hour),
      laneIndex: person.laneIndex,
      hour: hour.getHours(),
    })
    extendSelection(person, hour)
  }

  function shiftWindow(deltaDays: number) {
    if (sliding || deltaDays === 0) return
    setDraft(null)
    setHover(null)

    const track = slideTrackRef.current
    const dayCol = track?.querySelector<HTMLElement>("[data-day-col]")
    const dayWidth = dayCol?.getBoundingClientRect().width ?? 0

    if (!track || dayWidth <= 0) {
      setWindowOffsetDays((prev) => prev + deltaDays)
      return
    }

    setSliding(true)
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    if (prefersReduced) {
      setWindowOffsetDays((prev) => prev + deltaDays)
      setSliding(false)
      return
    }

    // Next (+1): slide left. Back (-1): slide right.
    track.style.transition = `transform ${SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
    track.style.transform = `translate3d(${-deltaDays * dayWidth}px, 0, 0)`

    window.setTimeout(() => {
      track.style.transition = "none"
      track.style.transform = "translate3d(0, 0, 0)"
      setWindowOffsetDays((prev) => prev + deltaDays)
      // Force layout so the next slide can animate again.
      void track.offsetHeight
      track.style.transition = ""
      setSliding(false)
    }, SLIDE_MS)
  }

  function goToToday() {
    if (sliding || windowOffsetDays === 0) return
    setDraft(null)
    setHover(null)
    setWindowOffsetDays(0)
  }

  if (loading) {
    return (
      <div className="flex h-full min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        Loading schedule…
      </div>
    )
  }

  const laneCount = ROSTER_LIMIT

  return (
    <div className="-mt-3 flex h-full min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Human resource</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Click an hour to save it. Hold and drag across hours for a range.
            Esc cancels.
          </p>
          {draft ? (
            <p className="text-xs font-medium text-foreground">
              {draft.mode === "set"
                ? "Selecting working hours…"
                : "Clearing working hours…"}{" "}
              <span className="font-normal text-muted-foreground">
                release to save
              </span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Previous day"
              disabled={sliding}
              onClick={() => shiftWindow(-WINDOW_STEP_DAYS)}
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={sliding || windowOffsetDays === 0}
              onClick={goToToday}
            >
              Today
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Next day"
              disabled={sliding}
              onClick={() => shiftWindow(WINDOW_STEP_DAYS)}
            >
              <ChevronRightIcon />
            </Button>
            <p className="ml-2 min-w-36 text-right text-xs font-medium text-muted-foreground">
              {rangeLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
          {lanes.map((lane) => {
            const laneIndex =
              lane.kind === "person" ? lane.person.laneIndex : lane.laneIndex
            const style = LANE_STYLES[laneIndex]
            if (lane.kind === "person") {
              const isYou = lane.person.id === currentUserId
              return (
                <div
                  key={lane.person.id}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs",
                    isYou
                      ? "border-foreground/15 bg-foreground/5 font-medium text-foreground"
                      : "border-border bg-background text-muted-foreground",
                  )}
                >
                  <span
                    className={cn("size-2.5 rounded-full", style?.dot ?? "bg-muted")}
                  />
                  {lane.person.displayName}
                  {isYou ? " · you" : ""}
                </div>
              )
            }
            return (
              <div
                key={`placeholder-legend-${lane.laneIndex}`}
                className="inline-flex items-center gap-2 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground"
              >
                <span
                  className={cn(
                    "size-2.5 rounded-full opacity-35",
                    style?.dot ?? "bg-muted",
                  )}
                />
                Open seat
              </div>
            )
          })}
          {!myLane ? (
            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-700 dark:text-amber-300">
              View only
            </span>
          ) : null}
          {saving ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2Icon className="size-3 animate-spin" />
              Saving…
            </span>
          ) : null}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/80 bg-gradient-to-b from-muted/40 to-background shadow-sm">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-auto overflow-y-hidden">
          <div className="flex min-h-0 min-w-[780px] flex-1 flex-col overflow-hidden">
          <div
            ref={slideTrackRef}
            className="flex min-h-0 flex-1 flex-col will-change-transform"
          >
            <div
              className="grid shrink-0"
              style={{
                gridTemplateColumns: `3.25rem repeat(${days.length}, minmax(0, 1fr))`,
              }}
            >
              <div className="border-b border-border/70 bg-background/95 backdrop-blur-sm" />
              {days.map((day) => {
                const today = isToday(day, now)
                return (
                  <div
                    key={dayKey(day)}
                    data-day-col
                    className={cn(
                      "border-b border-l border-border/70 px-1.5 py-2 backdrop-blur-sm",
                      today
                        ? "bg-[oklch(0.97_0.02_230)] dark:bg-[oklch(0.22_0.03_230)]"
                        : "bg-background/95",
                    )}
                  >
                    <p
                      className={cn(
                        "truncate text-center text-[11px] font-semibold tracking-wide",
                        today
                          ? "text-[oklch(0.45_0.1_230)] dark:text-[oklch(0.78_0.08_230)]"
                          : "text-foreground",
                      )}
                    >
                      {formatDayHeader(day)}
                      {today ? (
                        <span className="mt-0.5 block text-[9px] font-medium uppercase tracking-wider opacity-80">
                          Today
                        </span>
                      ) : null}
                    </p>
                    <div
                      className="mt-2 grid gap-1"
                      style={{
                        gridTemplateColumns: `repeat(${laneCount}, minmax(0, 1fr))`,
                      }}
                    >
                      {lanes.map((lane) => {
                        const laneIndex =
                          lane.kind === "person"
                            ? lane.person.laneIndex
                            : lane.laneIndex
                        const style = LANE_STYLES[laneIndex]
                        if (lane.kind === "person") {
                          return (
                            <div
                              key={lane.person.id}
                              title={lane.person.email || lane.person.displayName}
                              className={cn(
                                "flex h-6 items-center justify-center rounded-md text-[10px] font-semibold shadow-sm",
                                style?.chip ?? "bg-muted text-foreground",
                              )}
                            >
                              {getInitials(
                                lane.person.displayName,
                                lane.person.email,
                              )}
                            </div>
                          )
                        }
                        return (
                          <div
                            key={`placeholder-header-${lane.laneIndex}`}
                            title="Seat reserved for a future user"
                            className="flex h-6 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-[10px] font-medium text-muted-foreground"
                          >
                            ?
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `3.25rem repeat(${days.length}, minmax(0, 1fr))`,
                }}
              >
                {Array.from({ length: 24 }, (_, hour) => {
                  const isCurrentHourRow = hour === currentHour
                  return (
                    <div key={hour} className="contents">
                      <div
                        className={cn(
                          "flex items-start justify-end border-t border-border/50 pr-2 pt-1.5 text-[10px] tabular-nums",
                          isCurrentHourRow
                            ? "bg-[oklch(0.97_0.02_230)] font-semibold text-[oklch(0.45_0.1_230)] dark:bg-[oklch(0.22_0.03_230)] dark:text-[oklch(0.78_0.08_230)]"
                            : "bg-background text-muted-foreground",
                          hour % 2 === 0 && !isCurrentHourRow && "bg-muted/20",
                        )}
                      >
                        {formatHourLabel(new Date(2000, 0, 1, hour))}
                      </div>
                      {days.map((day) => {
                        const hourDate = getDayHours(day)[hour]!
                        const dKey = dayKey(day)
                        const today = isToday(day, now)
                        return (
                          <div
                            key={`${dKey}-${hour}`}
                            className={cn(
                              "grid gap-1 border-t border-l border-border/50 p-1",
                              today &&
                                "bg-[oklch(0.98_0.012_230)] dark:bg-[oklch(0.2_0.02_230)]/50",
                              isCurrentHourRow &&
                                today &&
                                "bg-[oklch(0.96_0.025_230)] dark:bg-[oklch(0.24_0.035_230)]",
                              hour % 2 === 0 && !today && "bg-muted/15",
                            )}
                            style={{
                              gridTemplateColumns: `repeat(${laneCount}, minmax(0, 1fr))`,
                            }}
                            onMouseLeave={() => {
                              setHover((prev) =>
                                prev?.dayKey === dKey ? null : prev,
                              )
                            }}
                          >
                            {lanes.map((lane) => {
                              if (lane.kind === "placeholder") {
                                return (
                                  <div
                                    key={`placeholder-cell-${lane.laneIndex}-${hour}`}
                                    title="Seat reserved for a future user"
                                    className="h-7 rounded-md border border-dashed border-border/60 bg-muted/10"
                                  />
                                )
                              }

                              const person = lane.person
                              const style = LANE_STYLES[person.laneIndex]
                              const iso = toHourIso(hourDate)
                              const key = slotKey(person.id, iso)
                              const filled = slotSet.has(key)
                              const locked = isSlotLocked(hourDate, now)
                              const isMine = person.id === currentUserId
                              const interactive = isMine && !locked && !saving
                              const isHover =
                                hover?.dayKey === dKey &&
                                hover.laneIndex === person.laneIndex &&
                                hover.hour === hour
                              const inDraft =
                                draft?.userId === person.id &&
                                draft.dayKey === dKey &&
                                draftHours.has(iso)

                              return (
                                <button
                                  key={person.id}
                                  type="button"
                                  disabled={!interactive}
                                  title={
                                    locked
                                      ? "Locked (more than 48h ago)"
                                      : isMine
                                        ? person.displayName
                                        : `${person.displayName} (view only)`
                                  }
                                  onMouseEnter={() =>
                                    handleCellEnter(person, hourDate)
                                  }
                                  onPointerDown={(event) => {
                                    if (!interactive) return
                                    event.preventDefault()
                                    startSelection(person, hourDate)
                                  }}
                                  className={cn(
                                    "h-7 rounded-md transition-[background-color,box-shadow,transform] duration-100",
                                    !filled &&
                                      !isHover &&
                                      !inDraft &&
                                      "bg-background/70 ring-1 ring-border/60",
                                    (filled ||
                                      (isHover && interactive) ||
                                      inDraft) &&
                                      (style?.solid ?? "bg-muted"),
                                    (filled || inDraft) && "shadow-sm",
                                    locked && "opacity-35 saturate-50",
                                    interactive && "cursor-pointer",
                                    !interactive && "cursor-default",
                                    inDraft &&
                                      draft?.mode === "clear" &&
                                      "opacity-50 ring-2 ring-dashed ring-white/70",
                                    inDraft &&
                                      draft?.mode === "set" &&
                                      "ring-2 ring-white/50",
                                    isHover &&
                                      interactive &&
                                      !inDraft &&
                                      !filled &&
                                      "ring-2 ring-white/40",
                                    interactive && "active:scale-[0.97]",
                                  )}
                                />
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}

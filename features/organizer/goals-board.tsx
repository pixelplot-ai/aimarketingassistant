"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  Loader2Icon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  GOAL_CATEGORIES,
  GOAL_CATEGORY_COLORS,
  GOAL_CATEGORY_LABELS,
  GOAL_HORIZON_LABELS,
  GOAL_HORIZON_SHORT_LABELS,
  GOAL_HORIZONS,
  allocationSum,
  DEFAULT_ALLOCATIONS,
  selectClassName,
  setAllocationPercent,
  tradeAllocationBetween,
  type GoalAllocations,
  type GoalCategory,
  type GoalHorizon,
  type OrganizerGoalRow,
} from "@/lib/organizer/goals"
import { cn } from "@/lib/utils"

export function GoalsBoard() {
  const [horizon, setHorizon] = useState<GoalHorizon>("short")
  const [goals, setGoals] = useState<OrganizerGoalRow[]>([])
  const [allocations, setAllocations] =
    useState<GoalAllocations>(DEFAULT_ALLOCATIONS)
  const [draftAllocations, setDraftAllocations] =
    useState<GoalAllocations>(DEFAULT_ALLOCATIONS)
  const [loading, setLoading] = useState(true)
  const [savingAllocations, setSavingAllocations] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<OrganizerGoalRow | null>(null)
  const [allocationCollapsed, setAllocationCollapsed] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("organizer.goals.allocationCollapsed")
      if (stored === "1") setAllocationCollapsed(true)
    } catch {
      // ignore
    }
  }, [])

  function toggleAllocationCollapsed() {
    setAllocationCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(
          "organizer.goals.allocationCollapsed",
          next ? "1" : "0",
        )
      } catch {
        // ignore
      }
      return next
    })
  }

  const load = useCallback(async (nextHorizon: GoalHorizon) => {
    const response = await fetch(
      `/api/organizer/goals?horizon=${nextHorizon}`,
    )
    const data = (await response.json()) as {
      goals?: OrganizerGoalRow[]
      allocations?: GoalAllocations
      error?: string
    }
    if (!response.ok) {
      throw new Error(data.error || "Could not load goals")
    }
    setGoals(data.goals ?? [])
    const next = data.allocations ?? DEFAULT_ALLOCATIONS
    setAllocations(next)
    setDraftAllocations(next)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    load(horizon)
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Failed to load")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [horizon, load])

  const draftSum = allocationSum(draftAllocations)
  const allocationsDirty = GOAL_CATEGORIES.some(
    (key) => draftAllocations[key] !== allocations[key],
  )

  async function saveAllocations() {
    if (draftSum !== 100) {
      toast.error("Allocations must sum to 100%")
      return
    }
    setSavingAllocations(true)
    try {
      const response = await fetch("/api/organizer/goals/allocations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftAllocations),
      })
      const data = (await response.json()) as {
        allocations?: GoalAllocations
        error?: string
      }
      if (!response.ok) {
        throw new Error(data.error || "Could not save allocations")
      }
      const next = data.allocations ?? draftAllocations
      setAllocations(next)
      setDraftAllocations(next)
      toast.success("Allocations saved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSavingAllocations(false)
    }
  }

  function nudgeAllocation(category: GoalCategory, delta: number) {
    setDraftAllocations((prev) =>
      setAllocationPercent(prev, category, prev[category] + delta),
    )
  }

  function tradeAdjacent(
    left: GoalCategory,
    right: GoalCategory,
    nextLeft: number,
  ) {
    setDraftAllocations((prev) =>
      tradeAllocationBetween(prev, left, right, nextLeft),
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Goals</h1>
          <p className="text-sm text-muted-foreground">
            Short is 1 month, medium 6 months, long 12+ months.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border bg-muted/40 p-0.5">
            {GOAL_HORIZONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setHorizon(value)
                  setEditingGoal(null)
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  horizon === value
                    ? "bg-background font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title={GOAL_HORIZON_LABELS[value]}
              >
                <span className="hidden sm:inline">
                  {value === "short"
                    ? "Short"
                    : value === "medium"
                      ? "Medium"
                      : "Long"}
                </span>
                <span className="sm:ml-1">{GOAL_HORIZON_SHORT_LABELS[value]}</span>
              </button>
            ))}
          </div>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <PlusIcon />
            Add
          </Button>
        </div>
      </div>

      <section
        className={cn(
          "rounded-xl border bg-card shadow-sm",
          allocationCollapsed ? "px-3 py-1.5" : "p-4",
        )}
      >
        {allocationCollapsed ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="allocation-panel"
              onClick={toggleAllocationCollapsed}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              aria-label="Expand category allocation"
              aria-expanded={false}
            >
              <span className="text-xs font-medium tracking-tight text-muted-foreground">
                Focus
              </span>
              <span className="flex h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                {GOAL_CATEGORIES.map((category) =>
                  draftAllocations[category] > 0 ? (
                    <span
                      key={category}
                      className="h-full"
                      style={{
                        width: `${draftAllocations[category]}%`,
                        backgroundColor: GOAL_CATEGORY_COLORS[category],
                      }}
                    />
                  ) : null,
                )}
              </span>
              <span className="hidden items-center gap-2 sm:inline-flex">
                {GOAL_CATEGORIES.map((category) => (
                  <span
                    key={category}
                    className="inline-flex items-center gap-1 text-[10px] tabular-nums text-muted-foreground"
                    title={GOAL_CATEGORY_LABELS[category]}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{
                        backgroundColor: GOAL_CATEGORY_COLORS[category],
                      }}
                    />
                    {draftAllocations[category]}%
                  </span>
                ))}
              </span>
            </button>
            {allocationsDirty ? (
              <Button
                type="button"
                size="sm"
                disabled={savingAllocations}
                onClick={() => void saveAllocations()}
              >
                {savingAllocations ? (
                  <Loader2Icon className="animate-spin" />
                ) : null}
                Save
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={toggleAllocationCollapsed}
              aria-expanded={false}
              aria-controls="allocation-panel"
              aria-label="Expand allocation"
            >
              <ChevronDownIcon />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <h2 className="text-sm font-semibold tracking-tight">
                  Category allocation
                </h2>
                <p className="text-xs text-muted-foreground">
                  Drag the bar dividers for quick splits, or use + / − for fine
                  adjustments. Total stays at 100%.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {allocationsDirty ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={savingAllocations}
                    onClick={() => void saveAllocations()}
                  >
                    {savingAllocations ? (
                      <Loader2Icon className="animate-spin" />
                    ) : null}
                    Save
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleAllocationCollapsed}
                  aria-expanded
                  aria-controls="allocation-panel"
                >
                  <ChevronUpIcon />
                  Collapse
                </Button>
              </div>
            </div>

            <div
              id="allocation-panel"
              className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-center"
            >
              <AllocationPieSummary allocations={draftAllocations} />
              <div className="min-w-0 flex-1 space-y-4">
                <AllocationStackedBar
                  allocations={draftAllocations}
                  onTrade={tradeAdjacent}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  {GOAL_CATEGORIES.map((category) => (
                    <div
                      key={category}
                      className="flex items-center justify-between gap-2 rounded-lg border bg-background/60 px-2.5 py-2"
                    >
                      <div className="inline-flex min-w-0 items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor: GOAL_CATEGORY_COLORS[category],
                          }}
                        />
                        <span className="truncate text-sm font-medium">
                          {GOAL_CATEGORY_LABELS[category]}
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {draftAllocations[category]}%
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label={`Decrease ${GOAL_CATEGORY_LABELS[category]}`}
                          disabled={draftAllocations[category] <= 0}
                          onClick={() => nudgeAllocation(category, -1)}
                        >
                          <MinusIcon />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label={`Increase ${GOAL_CATEGORY_LABELS[category]}`}
                          disabled={draftAllocations[category] >= 100}
                          onClick={() => nudgeAllocation(category, 1)}
                        >
                          <PlusIcon />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Loading goals…
          </div>
        ) : goals.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
            No {GOAL_HORIZON_SHORT_LABELS[horizon]} goals yet.
          </div>
        ) : (
          <ul className="flex flex-col gap-2 pb-2">
            {goals.map((goal) => (
              <li key={goal.id}>
                <GoalRow
                  goal={goal}
                  onEdit={() => setEditingGoal(goal)}
                  onDelete={async () => {
                    if (
                      !window.confirm(
                        `Delete “${goal.title}”? This cannot be undone.`,
                      )
                    ) {
                      return
                    }
                    setSaving(true)
                    try {
                      const response = await fetch(
                        `/api/organizer/goals/${goal.id}`,
                        { method: "DELETE" },
                      )
                      const data = (await response.json()) as {
                        error?: string
                      }
                      if (!response.ok) {
                        throw new Error(data.error || "Could not delete goal")
                      }
                      setGoals((prev) => prev.filter((g) => g.id !== goal.id))
                      if (editingGoal?.id === goal.id) setEditingGoal(null)
                      toast.success("Goal deleted")
                    } catch (err) {
                      toast.error(
                        err instanceof Error ? err.message : "Delete failed",
                      )
                    } finally {
                      setSaving(false)
                    }
                  }}
                  deleting={saving}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {createOpen ? (
        <GoalModal
          title="New goal"
          horizon={horizon}
          saving={saving}
          onClose={() => !saving && setCreateOpen(false)}
          onSubmit={async (payload) => {
            setSaving(true)
            try {
              const response = await fetch("/api/organizer/goals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              })
              const data = (await response.json()) as {
                goal?: OrganizerGoalRow
                error?: string
              }
              if (!response.ok) {
                throw new Error(data.error || "Could not create goal")
              }
              setCreateOpen(false)
              if (data.goal) {
                if (data.goal.horizon === horizon) {
                  setGoals((prev) => [data.goal!, ...prev])
                } else {
                  setHorizon(data.goal.horizon)
                }
              }
              toast.success("Goal created")
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Create failed")
            } finally {
              setSaving(false)
            }
          }}
        />
      ) : null}

      {editingGoal ? (
        <GoalModal
          title="Edit goal"
          horizon={editingGoal.horizon}
          initial={editingGoal}
          saving={saving}
          onClose={() => !saving && setEditingGoal(null)}
          onSubmit={async (payload) => {
            setSaving(true)
            try {
              const response = await fetch(
                `/api/organizer/goals/${editingGoal.id}`,
                {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                },
              )
              const data = (await response.json()) as {
                goal?: OrganizerGoalRow
                error?: string
              }
              if (!response.ok) {
                throw new Error(data.error || "Could not update goal")
              }
              const updated = data.goal
              setEditingGoal(null)
              if (!updated) return
              if (updated.horizon !== horizon) {
                setGoals((prev) => prev.filter((g) => g.id !== updated.id))
                toast.success(`Moved to ${GOAL_HORIZON_LABELS[updated.horizon]}`)
              } else {
                setGoals((prev) =>
                  prev.map((g) => (g.id === updated.id ? updated : g)),
                )
                toast.success("Goal updated")
              }
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Update failed")
            } finally {
              setSaving(false)
            }
          }}
        />
      ) : null}
    </div>
  )
}

function AllocationPieSummary({ allocations }: { allocations: GoalAllocations }) {
  const slices = useMemo(() => {
    const total = allocationSum(allocations) || 1
    let angle = -90
    return GOAL_CATEGORIES.map((category) => {
      const value = allocations[category]
      const sweep = (value / total) * 360
      const start = angle
      angle += sweep
      return { category, value, start, sweep }
    }).filter((s) => s.value > 0)
  }, [allocations])

  const allZero = allocationSum(allocations) === 0

  return (
    <div className="mx-auto flex w-full max-w-[200px] shrink-0 flex-col items-center gap-2 lg:mx-0">
      <svg viewBox="0 0 120 120" className="size-40" aria-hidden>
        {allZero ? (
          <circle
            cx="60"
            cy="60"
            r="48"
            fill="none"
            stroke="currentColor"
            className="text-muted"
            strokeWidth="18"
          />
        ) : (
          slices.map((slice) => (
            <path
              key={slice.category}
              d={describeDonutSlice(60, 60, 48, 30, slice.start, slice.sweep)}
              fill={GOAL_CATEGORY_COLORS[slice.category]}
            />
          ))
        )}
        <circle cx="60" cy="60" r="28" className="fill-card" />
        <text
          x="60"
          y="58"
          textAnchor="middle"
          className="fill-foreground text-[11px] font-semibold"
        >
          Focus
        </text>
        <text
          x="60"
          y="72"
          textAnchor="middle"
          className="fill-muted-foreground text-[9px]"
        >
          {allocationSum(allocations)}%
        </text>
      </svg>
    </div>
  )
}

function AllocationStackedBar({
  allocations,
  onTrade,
}: {
  allocations: GoalAllocations
  onTrade: (
    left: GoalCategory,
    right: GoalCategory,
    nextLeft: number,
  ) => void
}) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const allocationsRef = useRef(allocations)
  const onTradeRef = useRef(onTrade)

  useEffect(() => {
    allocationsRef.current = allocations
  }, [allocations])

  useEffect(() => {
    onTradeRef.current = onTrade
  }, [onTrade])

  const boundaries = useMemo(() => {
    const edges: number[] = []
    let acc = 0
    for (let i = 0; i < GOAL_CATEGORIES.length - 1; i += 1) {
      acc += allocations[GOAL_CATEGORIES[i]!]
      edges.push(acc)
    }
    return edges
  }, [allocations])

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      if (draggingIndex == null) return
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      if (rect.width <= 0) return

      const left = GOAL_CATEGORIES[draggingIndex]!
      const right = GOAL_CATEGORIES[draggingIndex + 1]!
      const before = GOAL_CATEGORIES.slice(0, draggingIndex).reduce(
        (sum, key) => sum + allocationsRef.current[key],
        0,
      )
      const ratio = (event.clientX - rect.left) / rect.width
      const absolute = Math.round(ratio * 100)
      const nextLeft = absolute - before
      onTradeRef.current(left, right, nextLeft)
    }

    function onPointerUp() {
      setDraggingIndex(null)
    }

    if (draggingIndex == null) return
    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
    window.addEventListener("pointercancel", onPointerUp)
    return () => {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
      window.removeEventListener("pointercancel", onPointerUp)
    }
  }, [draggingIndex])

  return (
    <div className="space-y-2">
      <div
        ref={trackRef}
        className="relative flex h-10 w-full touch-none overflow-hidden rounded-full bg-muted"
        role="group"
        aria-label="Category allocation bar"
      >
        {GOAL_CATEGORIES.map((category) => (
          <div
            key={category}
            title={`${GOAL_CATEGORY_LABELS[category]} ${allocations[category]}%`}
            className="relative flex h-full items-center justify-center overflow-hidden text-[10px] font-semibold text-white/95 transition-[flex-grow] duration-75"
            style={{
              flexGrow: Math.max(allocations[category], 0),
              flexBasis: 0,
              backgroundColor: GOAL_CATEGORY_COLORS[category],
              minWidth: allocations[category] > 0 ? 4 : 0,
            }}
          >
            {allocations[category] >= 12 ? (
              <span className="tabular-nums">{allocations[category]}%</span>
            ) : null}
          </div>
        ))}

        {boundaries.map((edge, index) => (
          <button
            key={`divider-${GOAL_CATEGORIES[index]}`}
            type="button"
            aria-label={`Adjust ${GOAL_CATEGORY_LABELS[GOAL_CATEGORIES[index]!]} and ${GOAL_CATEGORY_LABELS[GOAL_CATEGORIES[index + 1]!]}`}
            className="absolute top-0 z-10 h-full w-4 -translate-x-1/2 cursor-ew-resize border-0 bg-transparent p-0"
            style={{ left: `${edge}%` }}
            onPointerDown={(event) => {
              event.preventDefault()
              setDraggingIndex(index)
            }}
          >
            <span
              className={cn(
                "pointer-events-none absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow-md",
                draggingIndex === index && "scale-110",
              )}
            />
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Drag the handles between segments to rebalance adjacent categories.
      </p>
    </div>
  )
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

function describeDonutSlice(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  startAngle: number,
  sweep: number,
) {
  if (sweep >= 359.99) {
    return [
      `M ${cx} ${cy - outer}`,
      `A ${outer} ${outer} 0 1 1 ${cx - 0.01} ${cy - outer}`,
      `L ${cx - 0.01} ${cy - inner}`,
      `A ${inner} ${inner} 0 1 0 ${cx} ${cy - inner}`,
      "Z",
    ].join(" ")
  }

  const endAngle = startAngle + sweep
  const large = sweep > 180 ? 1 : 0
  const os = polar(cx, cy, outer, startAngle)
  const oe = polar(cx, cy, outer, endAngle)
  const is = polar(cx, cy, inner, endAngle)
  const ie = polar(cx, cy, inner, startAngle)

  return [
    `M ${os.x} ${os.y}`,
    `A ${outer} ${outer} 0 ${large} 1 ${oe.x} ${oe.y}`,
    `L ${is.x} ${is.y}`,
    `A ${inner} ${inner} 0 ${large} 0 ${ie.x} ${ie.y}`,
    "Z",
  ].join(" ")
}

function GoalRow({
  goal,
  onEdit,
  onDelete,
  deleting,
}: {
  goal: OrganizerGoalRow
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <div className="flex w-full items-start gap-2 rounded-xl border border-border/80 bg-card px-3 py-2.5 shadow-sm">
      <button
        type="button"
        onClick={onEdit}
        className="min-w-0 flex-1 cursor-pointer text-left transition-colors hover:opacity-90"
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium tracking-tight">{goal.title}</p>
          {goal.categories.map((category) => (
            <span
              key={category}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              <span
                className="size-1.5 rounded-full"
                style={{
                  backgroundColor: GOAL_CATEGORY_COLORS[category],
                }}
              />
              {GOAL_CATEGORY_LABELS[category]}
            </span>
          ))}
        </div>
        {goal.description ? (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {goal.description}
          </p>
        ) : null}
      </button>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onEdit}
          aria-label="Edit goal"
        >
          <PencilIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={deleting}
          className="text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400"
          onClick={onDelete}
          aria-label="Delete goal"
        >
          <Trash2Icon />
        </Button>
      </div>
    </div>
  )
}

function GoalModal({
  title,
  horizon,
  initial,
  saving,
  onClose,
  onSubmit,
}: {
  title: string
  horizon: GoalHorizon
  initial?: OrganizerGoalRow
  saving: boolean
  onClose: () => void
  onSubmit: (payload: {
    title: string
    description: string
    horizon: GoalHorizon
    categories: GoalCategory[]
  }) => Promise<void>
}) {
  const [goalTitle, setGoalTitle] = useState(initial?.title ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [goalHorizon, setGoalHorizon] = useState<GoalHorizon>(
    initial?.horizon ?? horizon,
  )
  const [categories, setCategories] = useState<GoalCategory[]>(
    initial?.categories?.length ? initial.categories : ["administrative"],
  )

  useEffect(() => {
    setGoalTitle(initial?.title ?? "")
    setDescription(initial?.description ?? "")
    setGoalHorizon(initial?.horizon ?? horizon)
    setCategories(
      initial?.categories?.length ? initial.categories : ["administrative"],
    )
  }, [initial, horizon])

  function toggleCategory(value: GoalCategory) {
    setCategories((prev) => {
      if (prev.includes(value)) {
        if (prev.length === 1) return prev
        return prev.filter((category) => category !== value)
      }
      return [...prev, value]
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-2xl border bg-background p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            <p className="text-sm text-muted-foreground">
              Anyone on the team can add, edit, or delete goals.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close"
          >
            <XIcon />
          </Button>
        </div>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void onSubmit({
              title: goalTitle,
              description,
              horizon: goalHorizon,
              categories,
            })
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="goal-title">Title</Label>
            <Input
              id="goal-title"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              placeholder="What are we aiming for?"
              required
              autoFocus
              disabled={saving}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-description">Description</Label>
            <Textarea
              id="goal-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional context…"
              rows={4}
              disabled={saving}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-horizon">Horizon</Label>
            <select
              id="goal-horizon"
              value={goalHorizon}
              onChange={(e) =>
                setGoalHorizon(e.target.value as GoalHorizon)
              }
              className={selectClassName}
              disabled={saving}
            >
              {GOAL_HORIZONS.map((value) => (
                <option key={value} value={value}>
                  {GOAL_HORIZON_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium leading-none">Categories</p>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Categories"
            >
              {GOAL_CATEGORIES.map((value) => {
                const selected = categories.includes(value)
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    disabled={saving}
                    onClick={() => toggleCategory(value)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      selected
                        ? "border-transparent bg-muted text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{
                        backgroundColor: GOAL_CATEGORY_COLORS[value],
                      }}
                    />
                    {GOAL_CATEGORY_LABELS[value]}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !goalTitle.trim()}>
              {saving ? <Loader2Icon className="animate-spin" /> : null}
              {initial ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

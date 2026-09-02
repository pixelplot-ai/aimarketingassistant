"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AutoScrollActivator,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DropAnimation,
  type Modifier,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  CheckIcon,
  GripVerticalIcon,
  Loader2Icon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDeleteDialog } from "@/features/organizer/confirm-delete-dialog"
import { LANE_STYLES, type SchedulePerson } from "@/lib/organizer/schedule"
import {
  buildRosterSeats,
  rosterSeatLabel,
} from "@/lib/organizer/roster"
import {
  PRIORITY_STYLES,
  TASK_CATEGORIES,
  TASK_CATEGORY_LABELS,
  formatTaskDate,
  isDueDateExpired,
  priorityTone,
  selectClassName,
  todayDateKey,
  type OrganizerTaskRow,
  type TaskCategory,
  type TaskSortKey,
  type TaskStatus,
} from "@/lib/organizer/tasks"
import { cn } from "@/lib/utils"

const restrictToVerticalAxis: Modifier = ({ transform }) => ({
  ...transform,
  x: 0,
})

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.4" } },
  }),
}

type Tab = TaskStatus

interface TasksBoardProps {
  currentUserId: string
}

export function TasksBoard({ currentUserId }: TasksBoardProps) {
  const [tab, setTab] = useState<Tab>("scheduled")
  const [roster, setRoster] = useState<SchedulePerson[]>([])
  const [tasks, setTasks] = useState<OrganizerTaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<OrganizerTaskRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [filterAssignee, setFilterAssignee] = useState<string>("all")
  const [sortKey, setSortKey] = useState<TaskSortKey>("priority")
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const onRoster = useMemo(
    () => roster.some((p) => p.id === currentUserId),
    [roster, currentUserId],
  )

  const load = useCallback(async (status: Tab) => {
    const response = await fetch(`/api/organizer/tasks?status=${status}`)
    const data = (await response.json()) as {
      roster?: SchedulePerson[]
      tasks?: OrganizerTaskRow[]
      error?: string
    }
    if (!response.ok) {
      throw new Error(data.error || "Could not load tasks")
    }
    setRoster(data.roster ?? [])
    setTasks(data.tasks ?? [])
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    load(tab)
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
  }, [tab, load])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const displayedTasks = useMemo(() => {
    let list = [...tasks]
    if (filterCategory !== "all") {
      list = list.filter((t) => t.category === filterCategory)
    }
    if (filterAssignee === "unassigned") {
      list = list.filter((t) => !t.assignee_id)
    } else if (filterAssignee !== "all") {
      list = list.filter((t) => t.assignee_id === filterAssignee)
    }

    if (sortKey === "title") {
      list.sort((a, b) => a.title.localeCompare(b.title))
    } else if (sortKey === "progress") {
      list.sort((a, b) => b.progress - a.progress)
    } else if (sortKey === "newest") {
      list.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    } else if (tab === "scheduled") {
      list.sort((a, b) => a.sort_order - b.sort_order)
    }

    return list
  }, [tasks, filterCategory, filterAssignee, sortKey, tab])

  const canDrag =
    onRoster &&
    tab === "scheduled" &&
    sortKey === "priority" &&
    filterCategory === "all" &&
    filterAssignee === "all"

  const activeDragTask = useMemo(() => {
    if (!activeDragId) return null
    return displayedTasks.find((t) => t.id === activeDragId) ?? null
  }, [activeDragId, displayedTasks])

  const activeDragIndex = useMemo(() => {
    if (!activeDragId) return -1
    return displayedTasks.findIndex((t) => t.id === activeDragId)
  }, [activeDragId, displayedTasks])

  async function patchTask(
    id: string,
    body: Record<string, unknown>,
  ): Promise<OrganizerTaskRow | null> {
    const response = await fetch(`/api/organizer/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = (await response.json()) as {
      task?: OrganizerTaskRow
      error?: string
    }
    if (!response.ok) {
      throw new Error(data.error || "Update failed")
    }
    return data.task ?? null
  }

  async function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id))
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null)
    if (!canDrag) return
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = tasks.findIndex((t) => t.id === active.id)
    const newIndex = tasks.findIndex((t) => t.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const previous = tasks
    const next = arrayMove(tasks, oldIndex, newIndex).map((task, index) => ({
      ...task,
      sort_order: index,
    }))
    setTasks(next)

    try {
      const response = await fetch("/api/organizer/tasks/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: next.map((t) => t.id) }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Reorder failed")
      }
    } catch (err) {
      setTasks(previous)
      toast.error(err instanceof Error ? err.message : "Reorder failed")
    }
  }

  function applyUpdatedTask(updated: OrganizerTaskRow) {
    if (updated.status !== tab) {
      setTasks((prev) => prev.filter((t) => t.id !== updated.id))
      toast.success(
        updated.status === "done" ? "Moved to Done" : "Reopened task",
      )
    } else {
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Shared board for the roster. Top of the list is highest priority.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border bg-muted/40 p-0.5">
            {(["scheduled", "done"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setTab(value)
                  setEditingTask(null)
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm capitalize transition-colors",
                  tab === value
                    ? "bg-background font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {value}
              </button>
            ))}
          </div>
          {onRoster ? (
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <PlusIcon />
              Add
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
        <div className="space-y-1.5">
          <Label htmlFor="filter-category">Category</Label>
          <select
            id="filter-category"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className={cn(selectClassName, "min-w-36")}
          >
            <option value="all">All</option>
            {TASK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {TASK_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-assignee">Assignee</Label>
          <select
            id="filter-assignee"
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className={cn(selectClassName, "min-w-40")}
          >
            <option value="all">All</option>
            <option value="unassigned">Unassigned</option>
            {buildRosterSeats(roster).map((seat) =>
              seat.kind === "person" ? (
                <option key={seat.person.id} value={seat.person.id}>
                  {rosterSeatLabel(seat)}
                </option>
              ) : (
                <option
                  key={`open-seat-${seat.laneIndex}`}
                  value={`open-seat-${seat.laneIndex}`}
                  disabled
                >
                  {rosterSeatLabel(seat)}
                </option>
              ),
            )}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sort-key">Sort</Label>
          <select
            id="sort-key"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as TaskSortKey)}
            className={cn(selectClassName, "min-w-36")}
          >
            <option value="priority">Priority</option>
            <option value="title">Title</option>
            <option value="progress">Progress</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      {!onRoster ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          View only — you are not on the roster.
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Loading tasks…
          </div>
        ) : displayedTasks.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
            No {tab} tasks yet.
          </div>
        ) : tab === "scheduled" && canDrag ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            autoScroll={{
              enabled: true,
              activator: AutoScrollActivator.Pointer,
              threshold: { x: 0.05, y: 0.12 },
              acceleration: 14,
              interval: 5,
            }}
            onDragStart={handleDragStart}
            onDragCancel={() => setActiveDragId(null)}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={displayedTasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="flex flex-col gap-2 pb-2">
                {displayedTasks.map((task, index) => (
                  <SortableTaskRow
                    key={task.id}
                    task={task}
                    index={index}
                    total={displayedTasks.length}
                    roster={roster}
                    canDrag
                    showPriority
                    onOpen={() => setEditingTask(task)}
                  />
                ))}
              </ul>
            </SortableContext>
            <DragOverlay dropAnimation={dropAnimation}>
              {activeDragTask ? (
                <TaskRow
                  task={activeDragTask}
                  index={activeDragIndex >= 0 ? activeDragIndex : 0}
                  total={displayedTasks.length}
                  roster={roster}
                  showPriority
                  onOpen={() => undefined}
                  dragHandle={
                    <div className="cursor-grabbing rounded p-1 text-muted-foreground">
                      <GripVerticalIcon className="size-4" />
                    </div>
                  }
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <ul className="flex flex-col gap-2 pb-2">
            {displayedTasks.map((task, index) => (
              <li key={task.id}>
                <TaskRow
                  task={task}
                  index={index}
                  total={displayedTasks.length}
                  roster={roster}
                  showPriority={tab === "scheduled"}
                  onOpen={() => setEditingTask(task)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {createOpen ? (
        <CreateTaskModal
          roster={roster}
          saving={saving}
          onClose={() => !saving && setCreateOpen(false)}
          onCreate={async (payload) => {
            setSaving(true)
            try {
              const response = await fetch("/api/organizer/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              })
              const data = (await response.json()) as {
                task?: OrganizerTaskRow
                error?: string
              }
              if (!response.ok) {
                throw new Error(data.error || "Could not create task")
              }
              setCreateOpen(false)
              if (tab === "scheduled" && data.task) {
                setTasks((prev) => [...prev, data.task!])
              } else {
                setTab("scheduled")
              }
              toast.success("Task created")
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Create failed")
            } finally {
              setSaving(false)
            }
          }}
        />
      ) : null}

      {editingTask ? (
        <EditTaskModal
          task={editingTask}
          roster={roster}
          currentUserId={currentUserId}
          onRoster={onRoster}
          saving={saving}
          onClose={() => !saving && setEditingTask(null)}
          onSave={async (body) => {
            setSaving(true)
            try {
              const updated = await patchTask(editingTask.id, body)
              if (!updated) return
              applyUpdatedTask(updated)
              setEditingTask(null)
              toast.success("Task updated")
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Update failed")
            } finally {
              setSaving(false)
            }
          }}
          onDelete={async () => {
            setSaving(true)
            try {
              const response = await fetch(
                `/api/organizer/tasks/${editingTask.id}`,
                { method: "DELETE" },
              )
              const data = (await response.json()) as { error?: string }
              if (!response.ok) {
                throw new Error(data.error || "Could not delete task")
              }
              setTasks((prev) => prev.filter((t) => t.id !== editingTask.id))
              setEditingTask(null)
              toast.success("Task deleted")
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Delete failed")
            } finally {
              setSaving(false)
            }
          }}
        />
      ) : null}
    </div>
  )
}

function personLabel(
  roster: SchedulePerson[],
  userId: string | null,
): string {
  if (!userId) return "Unassigned"
  return roster.find((p) => p.id === userId)?.displayName ?? "Unknown"
}

function assigneeSeatOptions(roster: SchedulePerson[]) {
  return (
    <>
      <option value="">Unassigned</option>
      {buildRosterSeats(roster).map((seat) =>
        seat.kind === "person" ? (
          <option key={seat.person.id} value={seat.person.id}>
            {rosterSeatLabel(seat)}
          </option>
        ) : (
          <option
            key={`open-seat-${seat.laneIndex}`}
            value=""
            disabled
          >
            {rosterSeatLabel(seat)}
          </option>
        ),
      )}
    </>
  )
}

function ModalShell({
  title,
  description,
  onClose,
  children,
}: {
  title: string
  description?: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-md rounded-xl border bg-background p-5 shadow-lg"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
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
        {children}
      </div>
    </div>
  )
}

function CreateTaskModal({
  roster,
  saving,
  onClose,
  onCreate,
}: {
  roster: SchedulePerson[]
  saving: boolean
  onClose: () => void
  onCreate: (payload: {
    title: string
    description: string
    category: TaskCategory
    assigneeId: string | null
    dueDate: string | null
  }) => Promise<void>
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<TaskCategory>("administrative")
  const [assigneeId, setAssigneeId] = useState("")
  const [dueDate, setDueDate] = useState("")
  const minDueDate = todayDateKey()

  return (
    <ModalShell
      title="New task"
      description="Title and description. Assignee and due date are optional."
      onClose={onClose}
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (dueDate && dueDate < minDueDate) {
            toast.error("Due date must be today or in the future")
            return
          }
          void onCreate({
            title,
            description,
            category,
            assigneeId: assigneeId || null,
            dueDate: dueDate || null,
          })
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="create-title">Title</Label>
          <Input
            id="create-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            required
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="create-description">Description</Label>
          <Textarea
            id="create-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional details…"
            rows={4}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="create-category">Category</Label>
          <select
            id="create-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as TaskCategory)}
            className={selectClassName}
          >
            {TASK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {TASK_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="create-assignee">Assignee</Label>
            <select
              id="create-assignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className={selectClassName}
            >
              {assigneeSeatOptions(roster)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-due-date">Due date</Label>
            <Input
              id="create-due-date"
              type="date"
              min={minDueDate}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
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
          <Button type="submit" disabled={saving || !title.trim()}>
            {saving ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
            Create
          </Button>
        </div>
      </form>
    </ModalShell>
  )
}

function EditTaskModal({
  task,
  roster,
  currentUserId,
  onRoster,
  saving,
  onClose,
  onSave,
  onDelete,
}: {
  task: OrganizerTaskRow
  roster: SchedulePerson[]
  currentUserId: string
  onRoster: boolean
  saving: boolean
  onClose: () => void
  onSave: (body: Record<string, unknown>) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const isAssignee = task.assignee_id === currentUserId
  const canEditAssigneeFields =
    isAssignee || (task.assignee_id === null && onRoster)

  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? "")
  const [category, setCategory] = useState<TaskCategory>(task.category)
  const [assigneeId, setAssigneeId] = useState(task.assignee_id ?? "")
  const [dueDate, setDueDate] = useState(task.due_date ?? "")
  const [notes, setNotes] = useState(task.notes)
  const [progress, setProgress] = useState(task.progress)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const minDueDate = todayDateKey()

  useEffect(() => {
    setTitle(task.title)
    setDescription(task.description ?? "")
    setCategory(task.category)
    setAssigneeId(task.assignee_id ?? "")
    setDueDate(task.due_date ?? "")
    setNotes(task.notes)
    setProgress(task.progress)
  }, [task])

  return (
    <ModalShell
      title="Edit task"
      description={`Created ${formatTaskDate(task.created_at, true)}`}
      onClose={onClose}
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (onRoster && dueDate && dueDate < minDueDate) {
            toast.error("Due date must be today or in the future")
            return
          }
          const body: Record<string, unknown> = {
            notes,
          }
          if (onRoster) {
            body.title = title
            body.description = description
            body.category = category
            body.assigneeId = assigneeId || null
            body.dueDate = dueDate || null
          }
          if (canEditAssigneeFields) {
            body.progress = progress
          }
          void onSave(body)
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="edit-title">Title</Label>
          <Input
            id="edit-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!onRoster || saving}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-description">Description</Label>
          <Textarea
            id="edit-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!onRoster || saving}
            rows={3}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-category">Category</Label>
            <select
              id="edit-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as TaskCategory)}
              disabled={!onRoster || saving}
              className={selectClassName}
            >
              {TASK_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {TASK_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-assignee">Assignee</Label>
            <select
              id="edit-assignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              disabled={!onRoster || saving}
              className={selectClassName}
            >
              {assigneeSeatOptions(roster)}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-due-date">Due date</Label>
          <Input
            id="edit-due-date"
            type="date"
            min={minDueDate}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={!onRoster || saving}
          />
          {isDueDateExpired(task.due_date) ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              Current due date is expired — pick today or later, or clear it.
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-notes">Notes</Label>
          <Textarea
            id="edit-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={saving}
            rows={3}
            placeholder="Add notes for the team…"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="edit-progress">Progress</Label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {progress}%
            </span>
          </div>
          <input
            id="edit-progress"
            type="range"
            min={0}
            max={100}
            step={5}
            value={progress}
            disabled={!canEditAssigneeFields || saving}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="w-full accent-foreground"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          {onRoster ? (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              className="text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2Icon />
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          {canEditAssigneeFields && task.status === "scheduled" ? (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() =>
                void onSave({
                  ...(onRoster
                    ? {
                        title,
                        description,
                        category,
                        assigneeId: assigneeId || null,
                        dueDate: dueDate || null,
                      }
                    : {}),
                  notes,
                  progress,
                  status: "done",
                })
              }
            >
              <CheckIcon />
              Mark done
            </Button>
          ) : null}
          {canEditAssigneeFields && task.status === "done" ? (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => void onSave({ status: "scheduled" })}
            >
              <RotateCcwIcon />
              Reopen
            </Button>
          ) : null}
          <Button
            type="submit"
            disabled={saving || (onRoster && !title.trim())}
          >
            {saving ? <Loader2Icon className="animate-spin" /> : null}
            Save
          </Button>
          </div>
        </div>
      </form>
      {confirmDelete ? (
        <ConfirmDeleteDialog
          title={`Delete “${task.title}”?`}
          saving={saving}
          onCancel={() => !saving && setConfirmDelete(false)}
          onConfirm={() => void onDelete()}
        />
      ) : null}
    </ModalShell>
  )
}

function SortableTaskRow({
  task,
  index,
  total,
  roster,
  canDrag,
  showPriority,
  onOpen,
}: {
  task: OrganizerTaskRow
  index: number
  total: number
  roster: SchedulePerson[]
  canDrag: boolean
  showPriority: boolean
  onOpen: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: !canDrag })

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(isDragging && "opacity-40")}
    >
      <TaskRow
        task={task}
        index={index}
        total={total}
        roster={roster}
        showPriority={showPriority}
        onOpen={onOpen}
        dragHandle={
          canDrag ? (
            <div
              className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
              aria-label="Drag to reorder"
              onClick={(e) => e.stopPropagation()}
              {...attributes}
              {...listeners}
            >
              <GripVerticalIcon className="size-4" />
            </div>
          ) : null
        }
      />
    </li>
  )
}

function TaskRow({
  task,
  index,
  total,
  roster,
  showPriority,
  onOpen,
  dragHandle,
}: {
  task: OrganizerTaskRow
  index: number
  total: number
  roster: SchedulePerson[]
  showPriority: boolean
  onOpen: () => void
  dragHandle?: React.ReactNode
}) {
  const tone = showPriority ? priorityTone(index, total) : "low"
  const priority = PRIORITY_STYLES[tone]
  const assignee = roster.find((p) => p.id === task.assignee_id)
  const laneStyle =
    assignee != null ? LANE_STYLES[assignee.laneIndex] : undefined
  const expired = isDueDateExpired(task.due_date)

  return (
    <div
      className={cn(
        "flex w-full items-center gap-2 rounded-xl border border-border/80 bg-card px-3 py-2 shadow-sm transition-colors hover:bg-muted/30",
        showPriority && `border-l-4 ${priority.border}`,
      )}
    >
      {dragHandle}
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onOpen()
          }
        }}
        className="flex min-w-0 flex-1 cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 text-left"
      >
        <p className="min-w-0 truncate font-medium tracking-tight">{task.title}</p>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {TASK_CATEGORY_LABELS[task.category]}
        </span>
        {showPriority ? (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
              priority.chip,
            )}
          >
            {priority.label}
          </span>
        ) : null}
        <span className="shrink-0 text-xs text-muted-foreground">
          Created {formatTaskDate(task.created_at)}
        </span>
        {expired ? (
          <span className="shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-700 dark:text-red-300">
            Expired
          </span>
        ) : task.due_date ? (
          <span className="shrink-0 text-xs text-muted-foreground">
            Due {formatTaskDate(task.due_date)}
          </span>
        ) : null}
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:ml-auto">
          <span
            className={cn(
              "size-2 rounded-full",
              laneStyle?.dot ?? "bg-muted-foreground/50",
            )}
          />
          {personLabel(roster, task.assignee_id)}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
          <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
            <span
              className={cn("block h-full rounded-full", priority.bar)}
              style={{ width: `${task.progress}%` }}
            />
          </span>
          {task.progress}%
        </span>
      </div>
    </div>
  )
}

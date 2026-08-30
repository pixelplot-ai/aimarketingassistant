import { NextResponse, type NextRequest } from "next/server"

import { requireAdminUser } from "@/lib/organizer/auth"
import { getRoster, isOnRoster } from "@/lib/organizer/roster"
import {
  patchTaskBodySchema,
  type OrganizerTaskRow,
} from "@/lib/organizer/tasks"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAdminUser()
    if ("error" in auth && auth.error) return auth.error
    const { supabase, user } = auth
    const { id } = await context.params

    const json: unknown = await request.json()
    const parsed = patchTaskBodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 },
      )
    }

    const body = parsed.data
    const roster = await getRoster()
    const onRoster = isOnRoster(roster, user.id)

    const { data: existing, error: loadError } = await supabase
      .from("organizer_tasks")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const task = existing as OrganizerTaskRow
    const isAssignee = task.assignee_id === user.id
    const canEditAssigneeFields =
      isAssignee || (task.assignee_id === null && onRoster)

    const rosterFields =
      body.title !== undefined ||
      body.description !== undefined ||
      body.category !== undefined ||
      body.assigneeId !== undefined ||
      body.dueDate !== undefined
    const assigneeFields =
      body.progress !== undefined || body.status !== undefined

    if (rosterFields && !onRoster) {
      return NextResponse.json(
        { error: "Only roster users can edit title, category, or assignee" },
        { status: 403 },
      )
    }
    if (assigneeFields && !canEditAssigneeFields) {
      return NextResponse.json(
        { error: "Only the assignee can edit progress or status" },
        { status: 403 },
      )
    }

    if (
      body.assigneeId !== undefined &&
      body.assigneeId !== null &&
      !isOnRoster(roster, body.assigneeId)
    ) {
      return NextResponse.json(
        { error: "Assignee must be on the roster" },
        { status: 400 },
      )
    }

    const updates: Record<string, unknown> = {}

    if (body.title !== undefined) updates.title = body.title
    if (body.description !== undefined) updates.description = body.description
    if (body.category !== undefined) updates.category = body.category
    if (body.assigneeId !== undefined) updates.assignee_id = body.assigneeId
    if (body.dueDate !== undefined) updates.due_date = body.dueDate
    if (body.notes !== undefined) updates.notes = body.notes

    let nextProgress = task.progress
    if (body.progress !== undefined) {
      nextProgress = body.progress
      updates.progress = body.progress
    }

    let nextStatus = task.status
    if (body.status !== undefined) {
      nextStatus = body.status
    }
    if (nextProgress >= 100) {
      nextStatus = "done"
      nextProgress = 100
      updates.progress = 100
    }

    if (nextStatus === "done" && task.status !== "done") {
      updates.status = "done"
      updates.completed_at = new Date().toISOString()
      if (nextProgress < 100) {
        updates.progress = 100
      }
    } else if (nextStatus === "scheduled" && task.status === "done") {
      const { data: maxRow } = await supabase
        .from("organizer_tasks")
        .select("sort_order")
        .eq("status", "scheduled")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle()

      const sortOrder =
        typeof maxRow?.sort_order === "number" ? maxRow.sort_order + 1 : 0

      updates.status = "scheduled"
      updates.completed_at = null
      updates.sort_order = sortOrder
    } else if (nextStatus !== task.status) {
      updates.status = nextStatus
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ task })
    }

    const { data, error } = await supabase
      .from("organizer_tasks")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ task: data as OrganizerTaskRow })
  } catch (err) {
    console.error("[organizer/tasks] PATCH error:", err)
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAdminUser()
    if ("error" in auth && auth.error) return auth.error
    const { supabase, user } = auth
    const { id } = await context.params

    const roster = await getRoster()
    if (!isOnRoster(roster, user.id)) {
      return NextResponse.json(
        { error: "Only roster users can delete tasks" },
        { status: 403 },
      )
    }

    const { data: existing, error: loadError } = await supabase
      .from("organizer_tasks")
      .select("id")
      .eq("id", id)
      .maybeSingle()

    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const { error } = await supabase.from("organizer_tasks").delete().eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[organizer/tasks] DELETE error:", err)
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

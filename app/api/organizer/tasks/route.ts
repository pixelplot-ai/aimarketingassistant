import { NextResponse, type NextRequest } from "next/server"

import { requireAdminUser } from "@/lib/organizer/auth"
import { getRoster, isOnRoster } from "@/lib/organizer/roster"
import {
  createTaskBodySchema,
  type OrganizerTaskRow,
  type TaskStatus,
} from "@/lib/organizer/tasks"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminUser()
    if ("error" in auth && auth.error) return auth.error
    const { supabase } = auth

    const statusParam = request.nextUrl.searchParams.get("status") ?? "scheduled"
    if (statusParam !== "scheduled" && statusParam !== "done") {
      return NextResponse.json(
        { error: "status must be scheduled or done" },
        { status: 400 },
      )
    }
    const status = statusParam as TaskStatus

    const roster = await getRoster()

    let query = supabase.from("organizer_tasks").select("*").eq("status", status)

    if (status === "scheduled") {
      query = query.order("sort_order", { ascending: true })
    } else {
      query = query.order("completed_at", { ascending: false })
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      roster,
      tasks: (data ?? []) as OrganizerTaskRow[],
    })
  } catch (err) {
    console.error("[organizer/tasks] GET error:", err)
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminUser()
    if ("error" in auth && auth.error) return auth.error
    const { supabase, user } = auth

    const roster = await getRoster()
    if (!isOnRoster(roster, user.id)) {
      return NextResponse.json(
        { error: "Only roster users can create tasks" },
        { status: 403 },
      )
    }

    const json: unknown = await request.json()
    const parsed = createTaskBodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 },
      )
    }

    const { title, description, category, assigneeId, dueDate } = parsed.data
    const resolvedAssignee =
      assigneeId && assigneeId.length > 0 ? assigneeId : null
    const resolvedDueDate = dueDate && dueDate.length > 0 ? dueDate : null

    if (resolvedAssignee && !isOnRoster(roster, resolvedAssignee)) {
      return NextResponse.json(
        { error: "Assignee must be on the roster" },
        { status: 400 },
      )
    }

    const { data: maxRow } = await supabase
      .from("organizer_tasks")
      .select("sort_order")
      .eq("status", "scheduled")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle()

    const sortOrder =
      typeof maxRow?.sort_order === "number" ? maxRow.sort_order + 1 : 0

    const { data, error } = await supabase
      .from("organizer_tasks")
      .insert({
        title,
        description: description ?? "",
        category,
        assignee_id: resolvedAssignee,
        due_date: resolvedDueDate,
        created_by: user.id,
        status: "scheduled",
        sort_order: sortOrder,
        progress: 0,
        notes: "",
      })
      .select("*")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ task: data as OrganizerTaskRow })
  } catch (err) {
    console.error("[organizer/tasks] POST error:", err)
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

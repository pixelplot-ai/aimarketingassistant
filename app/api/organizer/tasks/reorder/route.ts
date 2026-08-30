import { NextResponse, type NextRequest } from "next/server"

import { requireAdminUser } from "@/lib/organizer/auth"
import { getRoster, isOnRoster } from "@/lib/organizer/roster"
import { reorderTasksBodySchema } from "@/lib/organizer/tasks"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminUser()
    if ("error" in auth && auth.error) return auth.error
    const { supabase, user } = auth

    const roster = await getRoster()
    if (!isOnRoster(roster, user.id)) {
      return NextResponse.json(
        { error: "Only roster users can reorder tasks" },
        { status: 403 },
      )
    }

    const json: unknown = await request.json()
    const parsed = reorderTasksBodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 },
      )
    }

    const { orderedIds } = parsed.data

    const { data: scheduled, error: loadError } = await supabase
      .from("organizer_tasks")
      .select("id")
      .eq("status", "scheduled")

    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 500 })
    }

    const scheduledIds = new Set((scheduled ?? []).map((row) => row.id as string))
    if (
      orderedIds.length !== scheduledIds.size ||
      orderedIds.some((id) => !scheduledIds.has(id))
    ) {
      return NextResponse.json(
        { error: "orderedIds must match all scheduled tasks" },
        { status: 400 },
      )
    }

    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await supabase
        .from("organizer_tasks")
        .update({ sort_order: i })
        .eq("id", orderedIds[i]!)
        .eq("status", "scheduled")

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[organizer/tasks/reorder] POST error:", err)
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

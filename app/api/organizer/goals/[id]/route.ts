import { NextResponse, type NextRequest } from "next/server"

import { requireAdminUser } from "@/lib/organizer/auth"
import {
  normalizeGoalCategories,
  patchGoalBodySchema,
  type OrganizerGoalRow,
} from "@/lib/organizer/goals"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAdminUser()
    if ("error" in auth && auth.error) return auth.error
    const { supabase } = auth
    const { id } = await context.params

    const json: unknown = await request.json()
    const parsed = patchGoalBodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 },
      )
    }

    const body = parsed.data

    const { data: existing, error: loadError } = await supabase
      .from("organizer_goals")
      .select("id")
      .eq("id", id)
      .maybeSingle()

    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 })
    }

    const updates: Record<string, unknown> = {}
    if (body.title !== undefined) updates.title = body.title
    if (body.description !== undefined) updates.description = body.description
    if (body.horizon !== undefined) updates.horizon = body.horizon
    if (body.categories !== undefined) updates.categories = body.categories

    const { data, error } = await supabase
      .from("organizer_goals")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      goal: {
        ...(data as OrganizerGoalRow),
        categories: normalizeGoalCategories(
          (data as OrganizerGoalRow).categories,
        ),
      },
    })
  } catch (err) {
    console.error("[organizer/goals] PATCH error:", err)
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAdminUser()
    if ("error" in auth && auth.error) return auth.error
    const { supabase } = auth
    const { id } = await context.params

    const { data: existing, error: loadError } = await supabase
      .from("organizer_goals")
      .select("id")
      .eq("id", id)
      .maybeSingle()

    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 })
    }

    const { error } = await supabase
      .from("organizer_goals")
      .delete()
      .eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[organizer/goals] DELETE error:", err)
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

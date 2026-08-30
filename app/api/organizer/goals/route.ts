import { NextResponse, type NextRequest } from "next/server"

import { requireAdminUser } from "@/lib/organizer/auth"
import {
  allocationsFromRows,
  createGoalBodySchema,
  normalizeGoalCategories,
  type GoalHorizon,
  type OrganizerGoalRow,
} from "@/lib/organizer/goals"

function asGoalRow(row: OrganizerGoalRow): OrganizerGoalRow {
  return {
    ...row,
    categories: normalizeGoalCategories(row.categories),
  }
}

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminUser()
    if ("error" in auth && auth.error) return auth.error
    const { supabase } = auth

    const horizonParam = request.nextUrl.searchParams.get("horizon") ?? "short"
    if (
      horizonParam !== "short" &&
      horizonParam !== "medium" &&
      horizonParam !== "long"
    ) {
      return NextResponse.json(
        { error: "horizon must be short, medium, or long" },
        { status: 400 },
      )
    }
    const horizon = horizonParam as GoalHorizon

    const [goalsResult, allocationsResult] = await Promise.all([
      supabase
        .from("organizer_goals")
        .select("*")
        .eq("horizon", horizon)
        .order("created_at", { ascending: false }),
      supabase.from("organizer_goal_allocations").select("category, percent"),
    ])

    if (goalsResult.error) {
      return NextResponse.json(
        { error: goalsResult.error.message },
        { status: 500 },
      )
    }
    if (allocationsResult.error) {
      return NextResponse.json(
        { error: allocationsResult.error.message },
        { status: 500 },
      )
    }

    return NextResponse.json({
      goals: ((goalsResult.data ?? []) as OrganizerGoalRow[]).map(asGoalRow),
      allocations: allocationsFromRows(allocationsResult.data ?? []),
    })
  } catch (err) {
    console.error("[organizer/goals] GET error:", err)
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminUser()
    if ("error" in auth && auth.error) return auth.error
    const { supabase, user } = auth

    const json: unknown = await request.json()
    const parsed = createGoalBodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 },
      )
    }

    const { title, description, horizon, categories } = parsed.data

    const { data, error } = await supabase
      .from("organizer_goals")
      .insert({
        title,
        description: description ?? "",
        horizon,
        categories,
        created_by: user.id,
      })
      .select("*")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ goal: asGoalRow(data as OrganizerGoalRow) })
  } catch (err) {
    console.error("[organizer/goals] POST error:", err)
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

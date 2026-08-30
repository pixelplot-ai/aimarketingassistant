import { NextResponse, type NextRequest } from "next/server"

import { requireAdminUser } from "@/lib/organizer/auth"
import {
  allocationsBodySchema,
  GOAL_CATEGORIES,
  type GoalAllocations,
} from "@/lib/organizer/goals"

export const runtime = "nodejs"

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdminUser()
    if ("error" in auth && auth.error) return auth.error
    const { supabase, user } = auth

    const json: unknown = await request.json()
    const parsed = allocationsBodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 },
      )
    }

    const body = parsed.data

    const rows = GOAL_CATEGORIES.map((category) => ({
      category,
      percent: body[category],
      updated_by: user.id,
    }))

    const { error } = await supabase
      .from("organizer_goal_allocations")
      .upsert(rows, { onConflict: "category" })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ allocations: body as GoalAllocations })
  } catch (err) {
    console.error("[organizer/goals/allocations] PUT error:", err)
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import { NextResponse, type NextRequest } from "next/server"

import { requireAdminUser } from "@/lib/organizer/auth"
import { getRoster, isOnRoster } from "@/lib/organizer/roster"
import {
  isSlotLocked,
  schedulePostBodySchema,
  type WorkSlotRow,
} from "@/lib/organizer/schedule"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminUser()
    if ("error" in auth && auth.error) return auth.error
    const { supabase } = auth

    const from = request.nextUrl.searchParams.get("from")
    const to = request.nextUrl.searchParams.get("to")

    if (!from || !to) {
      return NextResponse.json(
        { error: "from and to query params are required" },
        { status: 400 },
      )
    }

    const fromDate = new Date(from)
    const toDate = new Date(to)
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return NextResponse.json({ error: "Invalid from/to dates" }, { status: 400 })
    }

    const roster = await getRoster()

    const { data, error } = await supabase
      .from("organizer_work_slots")
      .select("id, user_id, starts_at, created_at")
      .gte("starts_at", fromDate.toISOString())
      .lt("starts_at", toDate.toISOString())
      .order("starts_at", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      roster,
      slots: (data ?? []) as WorkSlotRow[],
    })
  } catch (err) {
    console.error("[organizer/schedule] GET error:", err)
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
    const parsed = schedulePostBodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 },
      )
    }

    const { startsAt, mode } = parsed.data
    const roster = await getRoster()
    if (!isOnRoster(roster, user.id)) {
      return NextResponse.json(
        { error: "You are not on the scheduling roster" },
        { status: 403 },
      )
    }

    const dates = startsAt.map((iso) => new Date(iso))
    if (dates.some((d) => Number.isNaN(d.getTime()))) {
      return NextResponse.json({ error: "Invalid startsAt values" }, { status: 400 })
    }

    const now = new Date()
    if (dates.some((d) => isSlotLocked(d, now))) {
      return NextResponse.json(
        { error: "Cannot modify slots more than 48 hours in the past" },
        { status: 400 },
      )
    }

    const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())
    const spanMs = sorted[sorted.length - 1]!.getTime() - sorted[0]!.getTime()
    if (spanMs > 23 * 60 * 60 * 1000) {
      return NextResponse.json(
        { error: "Range must stay within a single day" },
        { status: 400 },
      )
    }

    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i]!.getTime() - sorted[i - 1]!.getTime()
      if (gap !== 60 * 60 * 1000) {
        return NextResponse.json(
          { error: "Slots must be consecutive hours" },
          { status: 400 },
        )
      }
    }

    const isoList = sorted.map((d) => d.toISOString())

    if (mode === "clear") {
      const { error } = await supabase
        .from("organizer_work_slots")
        .delete()
        .eq("user_id", user.id)
        .in("starts_at", isoList)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ ok: true, mode, count: isoList.length })
    }

    const rows = isoList.map((starts_at) => ({
      user_id: user.id,
      starts_at,
    }))

    const { error } = await supabase
      .from("organizer_work_slots")
      .upsert(rows, { onConflict: "user_id,starts_at", ignoreDuplicates: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, mode, count: isoList.length })
  } catch (err) {
    console.error("[organizer/schedule] POST error:", err)
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

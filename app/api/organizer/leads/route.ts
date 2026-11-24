import { NextResponse } from "next/server"

import { requireAdminUser } from "@/lib/organizer/auth"
import {
  createLeadBodySchema,
  normalizePhone,
  type OrganizerLead,
  type OrganizerLeadActivityRow,
  type OrganizerLeadRow,
} from "@/lib/organizer/leads"

export const runtime = "nodejs"

function withActivities(
  row: OrganizerLeadRow & { activities?: OrganizerLeadActivityRow[] | null },
): OrganizerLead {
  const { activities, ...lead } = row
  return {
    ...lead,
    activities: [...(activities ?? [])].sort((a, b) =>
      a.happened_on === b.happened_on
        ? a.created_at.localeCompare(b.created_at)
        : b.happened_on.localeCompare(a.happened_on),
    ),
  }
}

export async function GET() {
  try {
    const auth = await requireAdminUser()
    if ("error" in auth && auth.error) return auth.error
    const { supabase } = auth

    const { data, error } = await supabase
      .from("organizer_leads")
      .select("*, activities:organizer_lead_activities(*)")
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const leads = (data ?? []).map((row) =>
      withActivities(
        row as OrganizerLeadRow & { activities?: OrganizerLeadActivityRow[] },
      ),
    )

    return NextResponse.json({ leads })
  } catch (err) {
    console.error("[organizer/leads] GET error:", err)
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminUser()
    if ("error" in auth && auth.error) return auth.error
    const { supabase, user } = auth

    const json: unknown = await request.json()
    const parsed = createLeadBodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 },
      )
    }

    const body = parsed.data
    if (!body.firstName && !body.lastName && !body.email) {
      return NextResponse.json({ error: "Name or email is required" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("organizer_leads")
      .insert({
        salutation: body.salutation,
        first_name: body.firstName,
        last_name: body.lastName,
        email: body.email,
        phone: normalizePhone(body.phone),
        temperature: body.temperature ?? null,
        stage: "new",
        company: body.company,
        job_title: body.jobTitle,
        notes: body.notes,
        owner_name: body.ownerName,
        next_step: body.nextStep,
        next_action_on: body.nextActionOn || null,
        next_action_time: body.nextActionTime || null,
        next_action: body.nextAction || "First follow-up",
        source: "manual",
        created_by: user.id,
      })
      .select("*, activities:organizer_lead_activities(*)")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      lead: withActivities(
        data as OrganizerLeadRow & { activities?: OrganizerLeadActivityRow[] },
      ),
    })
  } catch (err) {
    console.error("[organizer/leads] POST error:", err)
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import { NextResponse, type NextRequest } from "next/server"

import { requireAdminUser } from "@/lib/organizer/auth"
import {
  closeStepError,
  isClosedStage,
  normalizePhone,
  patchLeadBodySchema,
  stageAfterActivity,
  stageAfterClosedStep,
  type ActivityKind,
  type DisqualifyReason,
  type LeadStage,
  type NextStep,
  type OrganizerLead,
  type OrganizerLeadActivityRow,
  type OrganizerLeadRow,
} from "@/lib/organizer/leads"
import { todayDateKey } from "@/lib/organizer/tasks"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ id: string }>
}

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

function consistencyError(input: {
  stage: LeadStage
  disqualifyReason: DisqualifyReason | null
  nextStep: NextStep | null
  firstName: string
  lastName: string
  email: string
}): string | null {
  if (!input.firstName.trim() && !input.lastName.trim() && !input.email.trim()) {
    return "Name or email is required"
  }
  if (input.stage === "disqualified" && !input.disqualifyReason) {
    return "Disqualified leads need a reason"
  }
  if (input.stage !== "disqualified" && input.disqualifyReason) {
    return "Clear the reason unless the lead is disqualified"
  }
  if (!isClosedStage(input.stage) && !input.nextStep) {
    return "Open leads need a next step"
  }
  return null
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAdminUser()
    if ("error" in auth && auth.error) return auth.error
    const { supabase } = auth
    const { id } = await context.params

    const json: unknown = await request.json()
    const parsed = patchLeadBodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 },
      )
    }
    const body = parsed.data

    const { data: existing, error: loadError } = await supabase
      .from("organizer_leads")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    const current = existing as OrganizerLeadRow
    const closing = body.closeStep
    if (closing && body.activity) {
      return NextResponse.json(
        { error: "Close the step on its own" },
        { status: 400 },
      )
    }
    if (closing) {
      const stepProblem = closeStepError(closing)
      if (stepProblem) {
        return NextResponse.json({ error: stepProblem }, { status: 400 })
      }
      if (isClosedStage(current.stage) || !current.next_step) {
        return NextResponse.json(
          { error: "This lead has no open step" },
          { status: 400 },
        )
      }
    }

    let stage: LeadStage = body.stage ?? current.stage
    let disqualifyReason: DisqualifyReason | null =
      body.disqualifyReason !== undefined
        ? body.disqualifyReason
        : current.disqualify_reason
    let nextStep: NextStep | null =
      body.nextStep !== undefined ? body.nextStep : current.next_step
    let nextActionOn =
      body.nextActionOn !== undefined ? body.nextActionOn : current.next_action_on
    let nextActionTime =
      body.nextActionTime !== undefined ? body.nextActionTime : current.next_action_time
    let nextAction = body.nextAction !== undefined ? body.nextAction : current.next_action

    if (body.stage && body.stage !== "disqualified" && !closing) {
      disqualifyReason = null
    }

    const activity = body.activity
    const happenedOn = closing?.happenedOn || activity?.happenedOn || todayDateKey()
    let closedKind: ActivityKind | null = null
    if (closing && current.next_step) {
      closedKind = current.next_step
      if (closing.mode === "close") {
        stage = closing.stage ?? stage
        disqualifyReason =
          stage === "disqualified" ? (closing.disqualifyReason ?? null) : null
        nextStep = null
        nextActionOn = null
        nextActionTime = null
        nextAction = ""
      } else {
        stage = stageAfterClosedStep(current.stage, current.next_step)
        disqualifyReason = null
        nextStep = closing.nextStep ?? null
        nextActionOn = closing.nextActionOn ?? null
        nextActionTime = closing.nextActionTime ?? null
        nextAction = closing.nextAction?.trim() ?? ""
      }
    } else if (activity) {
      stage = stageAfterActivity(stage, activity.kind)
    }

    const firstName = body.firstName ?? current.first_name
    const lastName = body.lastName ?? current.last_name
    const email = body.email ?? current.email
    const problem = consistencyError({
      stage,
      disqualifyReason,
      nextStep,
      firstName,
      lastName,
      email,
    })
    if (problem) {
      return NextResponse.json({ error: problem }, { status: 400 })
    }

    const loggedKind = activity?.kind ?? closedKind
    if (activity || closing) {
      if (!loggedKind) {
        return NextResponse.json({ error: "This lead has no open step" }, { status: 400 })
      }
      const { error: activityError } = await supabase
        .from("organizer_lead_activities")
        .insert({
          lead_id: id,
          happened_on: happenedOn,
          author: activity?.author || current.owner_name,
          kind: loggedKind,
          body: activity?.body ?? closing?.outcome ?? "",
        })
      if (activityError) {
        return NextResponse.json({ error: activityError.message }, { status: 500 })
      }
    }

    const updates: Record<string, unknown> = {
      stage,
      disqualify_reason: disqualifyReason,
      next_step: nextStep,
      first_name: firstName,
      last_name: lastName,
      email,
    }
    if (body.salutation !== undefined) updates.salutation = body.salutation
    if (body.phone !== undefined) updates.phone = normalizePhone(body.phone)
    if (body.temperature !== undefined) updates.temperature = body.temperature
    if (body.notes !== undefined) updates.notes = body.notes
    if (body.jobTitle !== undefined) updates.job_title = body.jobTitle
    if (body.company !== undefined) updates.company = body.company
    if (body.jobFunction !== undefined) updates.job_function = body.jobFunction
    if (body.industry !== undefined) updates.industry = body.industry
    if (body.turnoverBand !== undefined) updates.turnover_band = body.turnoverBand
    if (body.employeeBand !== undefined) updates.employee_band = body.employeeBand
    if (body.country !== undefined) updates.country = body.country
    if (body.channel !== undefined) updates.channel = body.channel
    if (body.ownerName !== undefined) updates.owner_name = body.ownerName
    if (closing || body.nextActionOn !== undefined) updates.next_action_on = nextActionOn
    if (closing || body.nextActionTime !== undefined) {
      updates.next_action_time = nextActionTime
    }
    if (closing || body.nextAction !== undefined) updates.next_action = nextAction

    const touchKind = loggedKind
    if (touchKind) {
      if (
        !current.first_contact_on &&
        (touchKind === "email" || touchKind === "call" || touchKind === "whatsapp")
      ) {
        updates.first_contact_on = happenedOn
      }
      if (touchKind === "reply") updates.answered = true
      if (!current.owner_name && activity?.author && body.ownerName === undefined) {
        updates.owner_name = activity.author
      }
    }

    const { data, error } = await supabase
      .from("organizer_leads")
      .update(updates)
      .eq("id", id)
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
    console.error("[organizer/leads] PATCH error:", err)
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
      .from("organizer_leads")
      .select("id")
      .eq("id", id)
      .maybeSingle()

    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    const { error } = await supabase.from("organizer_leads").delete().eq("id", id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[organizer/leads] DELETE error:", err)
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import { createAdminClient } from "@/services/supabase/admin"
import {
  displayNameFromUser,
  ROSTER_LIMIT,
  type SchedulePerson,
} from "@/lib/organizer/schedule"

export type { SchedulePerson }

export type RosterSeat =
  | { kind: "person"; person: SchedulePerson }
  | { kind: "placeholder"; laneIndex: number }

/** Always four Human resource seats, including empty open seats. */
export function buildRosterSeats(roster: SchedulePerson[]): RosterSeat[] {
  return Array.from({ length: ROSTER_LIMIT }, (_, laneIndex) => {
    const person = roster.find((p) => p.laneIndex === laneIndex)
    if (person) return { kind: "person" as const, person }
    return { kind: "placeholder" as const, laneIndex }
  })
}

export function rosterSeatLabel(seat: RosterSeat): string {
  if (seat.kind === "person") return seat.person.displayName
  return `Open seat ${seat.laneIndex + 1}`
}

export async function getRoster(): Promise<SchedulePerson[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  })

  if (error) {
    throw new Error(error.message)
  }

  const sorted = [...(data.users ?? [])].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )

  return sorted.slice(0, ROSTER_LIMIT).map((u, laneIndex) => ({
    id: u.id,
    email: u.email ?? "",
    displayName: displayNameFromUser(u),
    laneIndex,
  }))
}

export function isOnRoster(
  roster: SchedulePerson[],
  userId: string,
): boolean {
  return roster.some((p) => p.id === userId)
}

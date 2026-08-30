import { createAdminClient } from "@/services/supabase/admin"
import {
  displayNameFromUser,
  ROSTER_LIMIT,
  type SchedulePerson,
} from "@/lib/organizer/schedule"

export type { SchedulePerson }

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

import type { Metadata } from "next"

import { WorkCalendar } from "@/features/organizer/work-calendar"
import { requireAuth } from "@/lib/auth/require-auth"

export const metadata: Metadata = {
  title: "Human resource",
}

export default async function HumanResourcePage() {
  const user = await requireAuth()

  return <WorkCalendar currentUserId={user.id} />
}

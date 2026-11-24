import type { Metadata } from "next"

import { LeadsBoard } from "@/features/organizer/leads-board"
import { requireAuth } from "@/lib/auth/require-auth"

export const metadata: Metadata = {
  title: "Leads",
}

export default async function LeadsPage() {
  await requireAuth()

  return <LeadsBoard />
}

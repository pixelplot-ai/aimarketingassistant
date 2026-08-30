import type { Metadata } from "next"

import { GoalsBoard } from "@/features/organizer/goals-board"
import { requireAuth } from "@/lib/auth/require-auth"

export const metadata: Metadata = {
  title: "Goals",
}

export default async function GoalsPage() {
  await requireAuth()

  return <GoalsBoard />
}

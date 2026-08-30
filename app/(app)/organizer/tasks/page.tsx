import type { Metadata } from "next"

import { TasksBoard } from "@/features/organizer/tasks-board"
import { requireAuth } from "@/lib/auth/require-auth"

export const metadata: Metadata = {
  title: "Task",
}

export default async function TasksPage() {
  const user = await requireAuth()

  return <TasksBoard currentUserId={user.id} />
}

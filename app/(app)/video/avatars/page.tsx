import type { Metadata } from "next"

import { AvatarsManager } from "@/features/avatars/avatars-manager"
import { requireAuth } from "@/lib/auth/require-auth"

export const metadata: Metadata = {
  title: "Library",
}

export default async function AvatarsPage() {
  const user = await requireAuth()

  return <AvatarsManager userId={user.id} />
}

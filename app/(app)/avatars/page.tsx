import { Suspense } from "react"

import { AvatarsManager } from "@/features/avatars/avatars-manager"
import { requireAuth } from "@/lib/auth/require-auth"

export default async function AvatarsPage() {
  const user = await requireAuth()

  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">Loading avatars…</p>
      }
    >
      <AvatarsManager userId={user.id} />
    </Suspense>
  )
}

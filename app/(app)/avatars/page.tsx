import { AvatarsManager } from "@/features/avatars/avatars-manager"
import { requireAuth } from "@/lib/auth/require-auth"

export default async function AvatarsPage() {
  const user = await requireAuth()

  return <AvatarsManager userId={user.id} />
}

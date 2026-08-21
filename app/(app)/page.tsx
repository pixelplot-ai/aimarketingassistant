import { SeedancePlayground } from "@/features/seedance/seedance-playground"
import { requireAuth } from "@/lib/auth/require-auth"

export default async function GeneratePage() {
  const user = await requireAuth()

  return <SeedancePlayground userId={user.id} />
}

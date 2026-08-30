import type { Metadata } from "next"

import { SeedancePlayground } from "@/features/seedance/seedance-playground"
import { requireAuth } from "@/lib/auth/require-auth"

export const metadata: Metadata = {
  title: "Video testing",
}

export default async function VideoTestingPage() {
  const user = await requireAuth()

  return <SeedancePlayground userId={user.id} />
}

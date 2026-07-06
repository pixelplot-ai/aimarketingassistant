import { cache } from "react"
import { redirect } from "next/navigation"
import type { User } from "@supabase/supabase-js"

import { getSessionUser } from "@/lib/auth/session"

export const requireAuth = cache(async (): Promise<User> => {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  return user
})

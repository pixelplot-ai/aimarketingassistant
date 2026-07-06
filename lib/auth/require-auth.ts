import { redirect } from "next/navigation"
import type { User } from "@supabase/supabase-js"

import { getSessionUser } from "@/lib/auth/session"

export async function requireAuth(): Promise<User> {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  return user
}

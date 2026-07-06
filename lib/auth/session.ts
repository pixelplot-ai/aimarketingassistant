import type { User } from "@supabase/supabase-js"

import { createClient } from "@/services/supabase/server"

export async function getSessionUser(): Promise<User | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}

import { cache } from "react"
import type { User } from "@supabase/supabase-js"

import { createClient } from "@/services/supabase/server"

export const getSessionUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
})

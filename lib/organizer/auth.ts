import { NextResponse } from "next/server"
import type { User } from "@supabase/supabase-js"

import { isAdminEmail } from "@/lib/auth/admin"
import { createClient } from "@/services/supabase/server"

export async function requireAdminUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }
  if (!isAdminEmail(user.email)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return { supabase, user: user as User }
}

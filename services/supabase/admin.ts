import { createClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database"

export function isAdminClientAvailable(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Admin client is unavailable.",
    )
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}

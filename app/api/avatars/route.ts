import { NextResponse } from "next/server"

import { isAdminEmail } from "@/lib/auth/admin"
import type { AvatarRow } from "@/lib/avatars/types"
import { createClient } from "@/services/supabase/server"

export const runtime = "nodejs"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!isAdminEmail(user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data, error } = await supabase
      .from("avatars")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ avatars: (data ?? []) as AvatarRow[] })
  } catch (err) {
    console.error("[avatars] list error:", err)
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

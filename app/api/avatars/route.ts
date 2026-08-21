import { NextResponse } from "next/server"

import { isAdminEmail } from "@/lib/auth/admin"
import type { AvatarRow } from "@/lib/avatars/types"
import { getVisualValidateResult } from "@/services/byteplus/assets"
import { createAdminClient } from "@/services/supabase/admin"
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

    const avatars = (data ?? []) as AvatarRow[]
    const admin = createAdminClient()

    for (const avatar of avatars) {
      if (
        avatar.status === "pending_verification" &&
        avatar.byted_token
      ) {
        try {
          const groupId = await getVisualValidateResult(avatar.byted_token)
          if (groupId) {
            await admin
              .from("avatars")
              .update({
                status: "verified",
                ark_group_id: groupId,
                error: null,
              })
              .eq("id", avatar.id)
            avatar.status = "verified"
            avatar.ark_group_id = groupId
            avatar.error = null
          }
        } catch (err) {
          console.error("[avatars] reconcile verify failed:", err)
        }
      }
    }

    return NextResponse.json({ avatars })
  } catch (err) {
    console.error("[avatars] list error:", err)
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import { NextResponse } from "next/server"

import { isAdminEmail } from "@/lib/auth/admin"
import type { AvatarAssetRow } from "@/lib/avatars/types"
import { createClient } from "@/services/supabase/server"

export const runtime = "nodejs"

/** Active avatar assets for the Generate picker. */
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
      .from("avatar_assets")
      .select("*, avatars!inner(id, name, status)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .eq("avatars.status", "verified")
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const assets = (data ?? []).map((row) => {
      const avatar = row.avatars as { id: string; name: string } | null
      return {
        ...(row as unknown as AvatarAssetRow),
        avatar_name: avatar?.name ?? "Avatar",
        asset_uri: row.ark_asset_id ? `asset://${row.ark_asset_id}` : null,
      }
    })

    return NextResponse.json({ assets })
  } catch (err) {
    console.error("[avatars] active list error:", err)
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

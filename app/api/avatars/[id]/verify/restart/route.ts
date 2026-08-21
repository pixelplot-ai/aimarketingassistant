import { NextResponse } from "next/server"

import { isAdminEmail } from "@/lib/auth/admin"
import type { AvatarRow } from "@/lib/avatars/types"
import { createVisualValidateSession } from "@/services/byteplus/assets"
import { createClient } from "@/services/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 30

type RouteContext = {
  params: Promise<{ id: string }>
}

/** Start a fresh H5 session for a pending avatar (or reopen after lost tab). */
export async function POST(_request: Request, context: RouteContext) {
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

    const { id } = await context.params
    const { data: avatar, error } = await supabase
      .from("avatars")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!avatar) {
      return NextResponse.json({ error: "Avatar not found" }, { status: 404 })
    }

    const row = avatar as AvatarRow
    if (row.status === "verified") {
      return NextResponse.json(
        { error: "Avatar is already verified." },
        { status: 400 },
      )
    }

    const session = await createVisualValidateSession()
    const { data: updated, error: updateError } = await supabase
      .from("avatars")
      .update({
        status: "pending_verification",
        byted_token: session.bytedToken,
        h5_link: session.h5Link,
        error: null,
      })
      .eq("id", id)
      .select("*")
      .single()

    if (updateError || !updated) {
      return NextResponse.json(
        { error: updateError?.message ?? "Could not update avatar" },
        { status: 500 },
      )
    }

    return NextResponse.json({
      avatarId: updated.id,
      h5Link: session.h5Link,
      avatar: updated,
    })
  } catch (err) {
    console.error("[avatars] verify restart error:", err)
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

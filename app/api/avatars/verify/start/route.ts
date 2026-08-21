import { NextResponse } from "next/server"
import { z } from "zod"

import { isAdminEmail } from "@/lib/auth/admin"
import { createVisualValidateSession } from "@/services/byteplus/assets"
import { createClient } from "@/services/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 30

const bodySchema = z.object({
  name: z.string().trim().min(1).max(64).default("Avatar"),
})

export async function POST(request: Request) {
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

    const json = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      )
    }

    const session = await createVisualValidateSession()

    const { data: avatar, error } = await supabase
      .from("avatars")
      .insert({
        user_id: user.id,
        name: parsed.data.name,
        status: "pending_verification",
        byted_token: session.bytedToken,
      })
      .select("*")
      .single()

    if (error || !avatar) {
      return NextResponse.json(
        { error: error?.message ?? "Could not create avatar" },
        { status: 500 },
      )
    }

    return NextResponse.json({
      avatarId: avatar.id,
      h5Link: session.h5Link,
      avatar,
    })
  } catch (err) {
    console.error("[avatars] verify start error:", err)
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

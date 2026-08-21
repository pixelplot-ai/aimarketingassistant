import { NextResponse } from "next/server"
import { z } from "zod"

import { isAdminEmail } from "@/lib/auth/admin"
import { createAigcAssetGroup } from "@/services/byteplus/assets"
import { createClient } from "@/services/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 30

const bodySchema = z.object({
  name: z.string().trim().min(1).max(64),
  description: z.string().trim().max(256).optional(),
})

/** Create an AIGC asset group (PDF flow — no real-human / H5 verification). */
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

    const group = await createAigcAssetGroup({
      name: parsed.data.name,
      description: parsed.data.description,
    })

    const { data: avatar, error } = await supabase
      .from("avatars")
      .insert({
        user_id: user.id,
        name: parsed.data.name.trim(),
        status: "verified",
        ark_group_id: group.id,
        error: null,
        byted_token: null,
        h5_link: null,
      })
      .select("*")
      .single()

    if (error || !avatar) {
      return NextResponse.json(
        { error: error?.message ?? "Could not create asset group row" },
        { status: 500 },
      )
    }

    return NextResponse.json({
      avatarId: avatar.id,
      groupId: group.id,
      avatar,
    })
  } catch (err) {
    console.error("[avatars] create group error:", err)
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

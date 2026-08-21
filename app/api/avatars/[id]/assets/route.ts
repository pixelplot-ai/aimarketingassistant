import { NextResponse } from "next/server"
import { z } from "zod"

import { isAdminEmail } from "@/lib/auth/admin"
import type { AvatarAssetRow, AvatarRow } from "@/lib/avatars/types"
import {
  createImageAsset,
  getAsset,
  mapArkAssetStatus,
} from "@/services/byteplus/assets"
import { createAdminClient } from "@/services/supabase/admin"
import { createClient } from "@/services/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

type RouteContext = {
  params: Promise<{ id: string }>
}

const createBodySchema = z.object({
  storagePath: z.string().min(1),
  name: z.string().trim().min(1).max(64).default("Portrait"),
})

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (!isAdminEmail(user.email)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { supabase, user }
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await requireUser()
    if ("error" in auth && auth.error) return auth.error
    const { supabase, user } = auth as {
      supabase: Awaited<ReturnType<typeof createClient>>
      user: { id: string }
    }

    const { id } = await context.params

    const { data: avatar, error: avatarError } = await supabase
      .from("avatars")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (avatarError) {
      return NextResponse.json({ error: avatarError.message }, { status: 500 })
    }
    if (!avatar) {
      return NextResponse.json({ error: "Avatar not found" }, { status: 404 })
    }

    const { data, error } = await supabase
      .from("avatar_assets")
      .select("*")
      .eq("avatar_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const assets = (data ?? []) as AvatarAssetRow[]
    const admin = createAdminClient()

    for (const asset of assets) {
      if (asset.status === "processing" && asset.ark_asset_id) {
        try {
          const state = await getAsset(asset.ark_asset_id)
          const next = mapArkAssetStatus(state.status)
          if (next !== "processing") {
            await admin
              .from("avatar_assets")
              .update({
                status: next,
                error: next === "failed" ? state.error ?? "Asset failed" : null,
              })
              .eq("id", asset.id)
            asset.status = next
            asset.error =
              next === "failed" ? state.error ?? "Asset failed" : null
          }
        } catch (err) {
          console.error("[avatars] reconcile asset failed:", err)
        }
      }
    }

    return NextResponse.json({
      avatar: avatar as AvatarRow,
      assets,
    })
  } catch (err) {
    console.error("[avatars] assets GET error:", err)
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await requireUser()
    if ("error" in auth && auth.error) return auth.error
    const { supabase, user } = auth as {
      supabase: Awaited<ReturnType<typeof createClient>>
      user: { id: string }
    }

    const { id } = await context.params
    const json = await request.json()
    const parsed = createBodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      )
    }

    if (!parsed.data.storagePath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: "Invalid media path" }, { status: 400 })
    }

    const { data: avatar, error: avatarError } = await supabase
      .from("avatars")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (avatarError) {
      return NextResponse.json({ error: avatarError.message }, { status: 500 })
    }
    if (!avatar) {
      return NextResponse.json({ error: "Avatar not found" }, { status: 404 })
    }

    const row = avatar as AvatarRow
    if (row.status !== "verified" || !row.ark_group_id) {
      return NextResponse.json(
        { error: "Avatar must be verified before uploading portraits." },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const { data: signed, error: signError } = await admin.storage
      .from("seedance-avatars")
      .createSignedUrl(parsed.data.storagePath, 60 * 60)

    if (signError || !signed?.signedUrl) {
      return NextResponse.json(
        { error: signError?.message ?? "Could not sign image URL" },
        { status: 500 },
      )
    }

    const { data: assetRow, error: insertError } = await supabase
      .from("avatar_assets")
      .insert({
        avatar_id: id,
        user_id: user.id,
        name: parsed.data.name,
        storage_path: parsed.data.storagePath,
        status: "processing",
      })
      .select("*")
      .single()

    if (insertError || !assetRow) {
      return NextResponse.json(
        { error: insertError?.message ?? "Could not create asset row" },
        { status: 500 },
      )
    }

    try {
      const created = await createImageAsset({
        groupId: row.ark_group_id,
        url: signed.signedUrl,
        name: parsed.data.name,
      })

      await admin
        .from("avatar_assets")
        .update({ ark_asset_id: created.id, status: "processing" })
        .eq("id", assetRow.id)

      // Immediate status check
      try {
        const state = await getAsset(created.id)
        const next = mapArkAssetStatus(state.status)
        if (next !== "processing") {
          await admin
            .from("avatar_assets")
            .update({
              status: next,
              error: next === "failed" ? state.error ?? "Asset failed" : null,
            })
            .eq("id", assetRow.id)
        }
      } catch {
        // keep processing
      }

      const { data: refreshed } = await supabase
        .from("avatar_assets")
        .select("*")
        .eq("id", assetRow.id)
        .single()

      return NextResponse.json({ asset: refreshed ?? assetRow })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create ModelArk asset"
      await admin
        .from("avatar_assets")
        .update({ status: "failed", error: message })
        .eq("id", assetRow.id)
      return NextResponse.json({ error: message }, { status: 502 })
    }
  } catch (err) {
    console.error("[avatars] assets POST error:", err)
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

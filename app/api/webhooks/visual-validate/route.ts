/**
 * ModelArk liveness H5 callback.
 * Query may include bytedToken / byted_token after the person completes verification.
 */

import { NextRequest, NextResponse } from "next/server"

import { getVisualValidateResult } from "@/services/byteplus/assets"
import { createAdminClient } from "@/services/supabase/admin"

export const runtime = "nodejs"
export const maxDuration = 30

function readBytedToken(request: NextRequest): string {
  const params = request.nextUrl.searchParams
  return (
    params.get("bytedToken")?.trim() ||
    params.get("byted_token")?.trim() ||
    params.get("BytedToken")?.trim() ||
    ""
  )
}

async function completeVerification(bytedToken: string) {
  const admin = createAdminClient()
  const { data: avatar } = await admin
    .from("avatars")
    .select("id, status")
    .eq("byted_token", bytedToken)
    .maybeSingle()

  if (!avatar) {
    return { outcome: "ignored_unknown_token" as const }
  }

  if (avatar.status === "verified") {
    return { outcome: "ignored_already_verified" as const, avatarId: avatar.id }
  }

  const groupId = await getVisualValidateResult(bytedToken)
  if (!groupId) {
    await admin
      .from("avatars")
      .update({
        status: "failed",
        error: "Verification finished but ModelArk returned no GroupId yet.",
      })
      .eq("id", avatar.id)
    return { outcome: "failed_no_group" as const, avatarId: avatar.id }
  }

  await admin
    .from("avatars")
    .update({
      status: "verified",
      ark_group_id: groupId,
      error: null,
    })
    .eq("id", avatar.id)

  return { outcome: "verified" as const, avatarId: avatar.id, groupId }
}

export async function GET(request: NextRequest) {
  const bytedToken = readBytedToken(request)
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || "http://localhost:3000"

  if (!bytedToken) {
    return NextResponse.redirect(`${appUrl}/video/avatars?error=missing_token`)
  }

  try {
    const result = await completeVerification(bytedToken)
    if (result.outcome === "verified" || result.outcome === "ignored_already_verified") {
      return NextResponse.redirect(
        `${appUrl}/video/avatars?verified=${result.avatarId ?? ""}`,
      )
    }
    return NextResponse.redirect(`${appUrl}/video/avatars?error=${result.outcome}`)
  } catch (error) {
    console.error("[avatars] visual-validate GET error:", error)
    return NextResponse.redirect(`${appUrl}/video/avatars?error=verify_failed`)
  }
}

export async function POST(request: NextRequest) {
  const bytedToken =
    readBytedToken(request) ||
    (await request
      .json()
      .then((body: { bytedToken?: string; byted_token?: string }) =>
        body.bytedToken?.trim() || body.byted_token?.trim() || "",
      )
      .catch(() => ""))

  if (!bytedToken) {
    return NextResponse.json({ error: "Missing bytedToken" }, { status: 400 })
  }

  try {
    const result = await completeVerification(bytedToken)
    return NextResponse.json({ received: true, ...result })
  } catch (error) {
    console.error("[avatars] visual-validate POST error:", error)
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    )
  }
}

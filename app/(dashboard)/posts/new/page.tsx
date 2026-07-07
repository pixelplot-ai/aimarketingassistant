import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { createClient } from "@/services/supabase/server"
import { getWorkspaceUserId } from "@/lib/auth/workspace"
import { DEFAULT_TIMEZONE } from "@/lib/validations/settings"

export const metadata: Metadata = {
  title: "New Post",
}

export const dynamic = "force-dynamic"

export default async function NewPostPage() {
  const workspaceUserId = await getWorkspaceUserId()
  const supabase = await createClient()

  const [{ data: brandProfile }] = await Promise.all([
    supabase
      .from("brand_profiles")
      .select("id")
      .eq("user_id", workspaceUserId)
      .maybeSingle(),
  ])

  const { data, error } = await supabase
    .from("posts")
    .insert({
      user_id: workspaceUserId,
      title: "Untitled post",
      content: "",
      media_type: "none",
      status: "draft",
      scheduled_at: null,
      timezone: DEFAULT_TIMEZONE,
      brand_profile_id: brandProfile?.id ?? null,
    })
    .select("id")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create draft post.")
  }

  redirect(`/posts/${data.id}/edit`)
}

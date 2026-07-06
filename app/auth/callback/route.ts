import { NextResponse } from "next/server"

import { isAdminEmail } from "@/lib/auth/admin"
import { setupWorkspaceAfterLogin } from "@/lib/auth/workspace"
import { createClient } from "@/services/supabase/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!isAdminEmail(user?.email)) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=unauthorized`)
  }

  if (user) {
    await setupWorkspaceAfterLogin(user.id)
  }

  return NextResponse.redirect(`${origin}/`)
}

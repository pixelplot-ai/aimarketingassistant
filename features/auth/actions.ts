"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { isAdminEmail } from "@/lib/auth/admin"
import { setupWorkspaceAfterLogin } from "@/lib/auth/workspace"
import { createClient } from "@/services/supabase/server"

async function getOrigin(): Promise<string> {
  const headersList = await headers()
  const origin = headersList.get("origin")

  if (origin) {
    return origin
  }

  const host =
    headersList.get("x-forwarded-host") ?? headersList.get("host")
  const protocol = headersList.get("x-forwarded-proto") ?? "http"

  if (host) {
    return `${protocol}://${host}`
  }

  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
}

export type SignInResult = {
  error?: string
}

export async function signInWithEmail(formData: {
  email: string
  password: string
}): Promise<SignInResult> {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.email,
    password: formData.password,
  })

  if (error) {
    return { error: error.message }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!isAdminEmail(user?.email)) {
    await supabase.auth.signOut()
    redirect("/login?error=unauthorized")
  }

  if (user) {
    await setupWorkspaceAfterLogin(user.id)
  }

  redirect("/")
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = await createClient()
  const origin = await getOrigin()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  })

  if (error || !data.url) {
    redirect("/login?error=oauth")
  }

  redirect(data.url)
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

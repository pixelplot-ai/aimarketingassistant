import { type NextRequest, NextResponse } from "next/server"

import { isAdminEmail } from "@/lib/auth/admin"
import { updateSession } from "@/services/supabase/proxy"

const AUTH_ROUTES = ["/login"]
const PUBLIC_PREFIXES = [
  "/_next",
  "/favicon.ico",
  "/auth/callback",
  "/api/cron/publish",
]

function isPublicAsset(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )
}

function isProtectedRoute(pathname: string): boolean {
  if (isPublicAsset(pathname) || isAuthRoute(pathname)) {
    return false
  }

  return true
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  if (user && isAuthRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/"
    redirectUrl.search = ""
    return NextResponse.redirect(redirectUrl)
  }

  if (user && isProtectedRoute(pathname) && !isAdminEmail(user.email)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/login"
    redirectUrl.searchParams.set("error", "unauthorized")
    return NextResponse.redirect(redirectUrl)
  }

  if (!user && isProtectedRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/login"
    redirectUrl.searchParams.set("redirectTo", pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

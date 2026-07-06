import { NextResponse } from "next/server"

import { publishDuePosts } from "@/services/scheduler/publish-service"

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return false
  }

  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return false
  }

  const token = authHeader.slice("Bearer ".length).trim()
  return token.length > 0 && token === cronSecret
}

/**
 * Cron endpoint for scheduled publishing.
 *
 * Secured via `Authorization: Bearer ${CRON_SECRET}`.
 * Wire to pg_cron (see publish-service.ts) or an external scheduler.
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const results = await publishDuePosts()

    return NextResponse.json({
      ok: true,
      processedPosts: results.length,
      results,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publish cron failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return POST(request)
}

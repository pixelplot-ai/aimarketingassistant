import { redirect } from "next/navigation"

interface LegacyAvatarsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function LegacyAvatarsPage({
  searchParams,
}: LegacyAvatarsPageProps) {
  const params = await searchParams
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      query.set(key, value)
    }
  }

  const suffix = query.toString()
  redirect(suffix ? `/video/avatars?${suffix}` : "/video/avatars")
}

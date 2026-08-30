import Link from "next/link"

import { Button } from "@/components/ui/button"
import { signOut } from "@/features/auth/actions"
import { requireAuth } from "@/lib/auth/require-auth"

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await requireAuth()

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between border-b px-6 py-4">
        <Link href="/" className="text-sm font-medium">
          Pixelplot
        </Link>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">{children}</div>
    </div>
  )
}

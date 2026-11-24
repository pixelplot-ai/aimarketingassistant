import Link from "next/link"

import { MobileNavMenu } from "@/components/layout/mobile-nav-menu"
import { ThemeToggle } from "@/components/theme-toggle"
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
    <div className="flex h-dvh flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]">
      <header className="relative z-30 flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-6">
        <Link href="/" className="text-sm font-medium">
          Pixelplot
        </Link>
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <p className="hidden max-w-[12rem] truncate text-sm text-muted-foreground sm:block lg:max-w-xs">
            {user.email}
          </p>
          <MobileNavMenu />
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

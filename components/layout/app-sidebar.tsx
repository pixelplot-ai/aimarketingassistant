"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ClapperboardIcon, LayoutGridIcon, UsersIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const NAV = [
  { href: "/video", label: "Generate", icon: ClapperboardIcon, exact: true },
  { href: "/video/avatars", label: "Library", icon: UsersIcon, exact: false },
] as const

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex w-52 shrink-0 flex-col border-r bg-muted/30">
      <div className="border-b px-4 py-4">
        <p className="text-sm font-semibold tracking-tight">Video testing</p>
        <p className="text-xs text-muted-foreground">Seedance</p>
      </div>
      <nav className="flex flex-col gap-1 p-2">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
        >
          <LayoutGridIcon className="size-4" />
          Modules
        </Link>
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-background font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

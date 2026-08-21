"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ClapperboardIcon, UsersIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const NAV = [
  { href: "/", label: "Generate", icon: ClapperboardIcon },
  { href: "/avatars", label: "Avatars", icon: UsersIcon },
] as const

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex w-52 shrink-0 flex-col border-r bg-muted/30">
      <div className="border-b px-4 py-4">
        <p className="text-sm font-semibold tracking-tight">Pixelplot</p>
        <p className="text-xs text-muted-foreground">Seedance</p>
      </div>
      <nav className="flex flex-col gap-1 p-2">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
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

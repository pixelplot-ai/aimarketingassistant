"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ClapperboardIcon,
  LayoutGridIcon,
  MenuIcon,
  UsersIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { ORGANIZER_NAV } from "@/lib/organizer/nav"
import { cn } from "@/lib/utils"

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  exact: boolean
}

const VIDEO_NAV: NavItem[] = [
  { href: "/video", label: "Generate", icon: ClapperboardIcon, exact: true },
  { href: "/video/avatars", label: "Library", icon: UsersIcon, exact: false },
]

export function MobileNavMenu() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const section = pathname.startsWith("/organizer")
    ? "organizer"
    : pathname.startsWith("/video")
      ? "video"
      : null

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  if (!section) return null

  const items: NavItem[] =
    section === "organizer"
      ? ORGANIZER_NAV.map((item) => ({ ...item, exact: false }))
      : VIDEO_NAV

  return (
    <div className="relative md:hidden">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="relative z-50"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <XIcon /> : <MenuIcon />}
      </Button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <nav
            aria-label={section === "organizer" ? "Organizer" : "Video"}
            className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border bg-background p-2 shadow-lg"
          >
            <Link
              href="/"
              className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground"
              onClick={() => setOpen(false)}
            >
              <LayoutGridIcon className="size-4" />
              Modules
            </Link>
            {items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm",
                    active
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground",
                  )}
                  onClick={() => setOpen(false)}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </>
      ) : null}
    </div>
  )
}

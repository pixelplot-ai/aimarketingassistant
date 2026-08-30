"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronsLeftIcon, ChevronsRightIcon, LayoutGridIcon } from "lucide-react"

import { ORGANIZER_NAV } from "@/lib/organizer/nav"
import { cn } from "@/lib/utils"

export function OrganizerSidebar() {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r bg-muted/30 transition-[width]",
        expanded ? "w-52" : "w-14",
      )}
    >
      <div className={cn("p-2", expanded ? "" : "flex justify-center")}>
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          title={expanded ? "Collapse sidebar" : "Expand sidebar"}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={expanded}
          className={cn(
            "flex rounded-lg text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground",
            expanded
              ? "w-full items-center gap-2 px-3 py-2 text-sm"
              : "size-10 items-center justify-center",
          )}
        >
          {expanded ? (
            <>
              <ChevronsLeftIcon className="size-4 shrink-0" />
              <span>Collapse</span>
            </>
          ) : (
            <ChevronsRightIcon className="size-4" />
          )}
        </button>
      </div>
      <nav
        className={cn(
          "flex flex-1 flex-col gap-1 pb-3",
          expanded ? "items-stretch px-2" : "items-center",
        )}
      >
        <Link
          href="/"
          title={expanded ? undefined : "Modules"}
          aria-label="Modules"
          className={cn(
            "flex rounded-lg text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground",
            expanded
              ? "items-center gap-2 px-3 py-2 text-sm"
              : "size-10 items-center justify-center",
          )}
        >
          <LayoutGridIcon className="size-4 shrink-0" />
          {expanded ? <span>Modules</span> : null}
        </Link>
        {ORGANIZER_NAV.map((item) => {
          const active = pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              title={expanded ? undefined : item.label}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex rounded-lg transition-colors",
                expanded
                  ? "items-center gap-2 px-3 py-2 text-sm"
                  : "size-10 items-center justify-center",
                active
                  ? "bg-background font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {expanded ? <span>{item.label}</span> : null}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

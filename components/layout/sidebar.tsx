"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BotMessageSquare,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutDashboard,
  Megaphone,
  Package,
  Settings,
} from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "sidebar-collapsed"

type NavItem = {
  title: string
  href: string
  icon: typeof LayoutDashboard
}

type NavGroup = {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Content",
    items: [
      {
        title: "Posts",
        href: "/posts",
        icon: FileText,
      },
      {
        title: "Calendar",
        href: "/calendar",
        icon: CalendarDays,
      },
    ],
  },
  {
    label: "Strategy",
    items: [
      {
        title: "Marketing Strategy",
        href: "/marketing-strategy",
        icon: Megaphone,
      },
      {
        title: "Products",
        href: "/products",
        icon: Package,
      },
    ],
  },
  {
    label: "Workspace",
    items: [
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
      },
    ],
  },
]

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/"
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

function AppLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      href="/"
      className={cn(
        "flex items-center font-semibold tracking-tight transition-opacity hover:opacity-90",
        collapsed ? "justify-center" : "gap-2.5",
      )}
      aria-label="AI Social Assistant home"
    >
      <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/25 ring-1 ring-white/20">
        <BotMessageSquare className="size-[1.125rem]" strokeWidth={2.25} />
      </span>
      {!collapsed ? (
        <span className="truncate text-sm leading-tight text-sidebar-foreground">
          AI Social
          <span className="block text-xs font-normal text-sidebar-foreground/55">
            Assistant
          </span>
        </span>
      ) : null}
    </Link>
  )
}

function NavLink({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem
  isActive: boolean
  collapsed: boolean
}) {
  const Icon = item.icon
  const linkClassName = cn(
    "group flex items-center rounded-xl text-sm transition-all duration-150",
    collapsed ? "size-10 justify-center px-0" : "gap-3 px-3 py-2",
    isActive
      ? cn(
          "bg-background font-semibold text-foreground shadow-sm ring-1 ring-sidebar-border/90",
          collapsed && "ring-sidebar-primary/25",
        )
      : "font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
  )

  const iconClassName = cn(
    "size-4 shrink-0 transition-colors",
    isActive
      ? "text-sidebar-primary"
      : "text-sidebar-foreground/45 group-hover:text-sidebar-foreground/80",
  )

  if (!collapsed) {
    return (
      <Link href={item.href} className={linkClassName} aria-current={isActive ? "page" : undefined}>
        <Icon className={iconClassName} />
        <span className="truncate">{item.title}</span>
      </Link>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={item.href}
            className={linkClassName}
            aria-label={item.title}
            aria-current={isActive ? "page" : undefined}
          />
        }
      >
        <Icon className={iconClassName} />
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {item.title}
      </TooltipContent>
    </Tooltip>
  )
}

function NavGroupSection({
  group,
  pathname,
  collapsed,
  showDivider,
}: {
  group: NavGroup
  pathname: string
  collapsed: boolean
  showDivider: boolean
}) {
  return (
    <div className={cn("flex flex-col", collapsed ? "gap-1" : "gap-1")}>
      {showDivider ? (
        <div
          className={cn(
            "my-1 border-t border-sidebar-border/80",
            collapsed ? "mx-1" : "mx-2",
          )}
          role="presentation"
        />
      ) : null}

      {!collapsed ? (
        <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
          {group.label}
        </p>
      ) : null}

      <div className={cn("flex flex-col gap-0.5", collapsed && "items-center")}>
        {group.items.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            isActive={isNavItemActive(pathname, item.href)}
            collapsed={collapsed}
          />
        ))}
      </div>
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      setCollapsed(stored === "true")
    }
  }, [])

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }

  return (
    <TooltipProvider delay={200}>
      <aside
        className={cn(
          "flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-in-out",
          collapsed ? "w-[4.25rem]" : "w-64",
        )}
      >
        <div
          className={cn(
            "flex h-14 items-center border-b border-sidebar-border/80 bg-sidebar-accent/30",
            collapsed ? "justify-center px-2" : "px-4",
          )}
        >
          <AppLogo collapsed={collapsed} />
        </div>

        <nav
          className={cn(
            "flex flex-1 flex-col overflow-y-auto p-2",
            collapsed && "items-center",
          )}
        >
          {navGroups.map((group, index) => (
            <NavGroupSection
              key={group.label}
              group={group}
              pathname={pathname}
              collapsed={collapsed}
              showDivider={index > 0}
            />
          ))}
        </nav>

        <div
          className={cn(
            "border-t border-sidebar-border p-2",
            collapsed ? "flex justify-center" : "",
          )}
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size={collapsed ? "icon-sm" : "sm"}
                  className={cn(
                    "rounded-xl text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    !collapsed && "w-full justify-start",
                  )}
                  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                  onClick={toggleCollapsed}
                />
              }
            >
              {collapsed ? (
                <ChevronRight className="size-4" />
              ) : (
                <>
                  <ChevronLeft className="size-4" />
                  Collapse
                </>
              )}
            </TooltipTrigger>
            {collapsed ? (
              <TooltipContent side="right" sideOffset={8}>
                Expand sidebar
              </TooltipContent>
            ) : null}
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  )
}

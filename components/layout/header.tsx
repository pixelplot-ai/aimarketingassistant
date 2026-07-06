"use client"

import { LogOut, Moon, Sun, User } from "lucide-react"
import { useTheme } from "next-themes"
import { useTransition } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut } from "@/features/auth/actions"

interface HeaderProps {
  userEmail?: string | null
}

function getInitials(email: string): string {
  const localPart = email.split("@")[0] ?? email
  const parts = localPart.split(/[._-]+/).filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase()
  }

  return localPart.slice(0, 2).toUpperCase()
}

export function Header({ userEmail }: HeaderProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [isSigningOut, startSignOutTransition] = useTransition()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-6">
      <div className="text-sm text-muted-foreground">
        Manage your social content with AI
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label="Toggle theme"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                aria-label="Open user menu"
              />
            }
          >
            <Avatar size="sm">
              <AvatarFallback>
                {userEmail ? getInitials(userEmail) : <User className="size-4" />}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              {userEmail ? (
                <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                  {userEmail}
                </DropdownMenuLabel>
              ) : null}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={isSigningOut}
              onClick={() => {
                startSignOutTransition(async () => {
                  await signOut()
                })
              }}
            >
              <LogOut className="size-4" />
              {isSigningOut ? "Signing out..." : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

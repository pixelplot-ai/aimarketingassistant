import type { Metadata } from "next"
import Link from "next/link"
import { ClapperboardIcon, FolderKanbanIcon } from "lucide-react"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Modules",
}

const MODULES = [
  {
    href: "/organizer",
    title: "Organizer",
    description: "Plan and organize work. This module is coming next.",
    icon: FolderKanbanIcon,
  },
  {
    href: "/video",
    title: "Video testing",
    description: "Generate and review Seedance videos and avatar assets.",
    icon: ClapperboardIcon,
  },
] as const

export default function ModulesPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">
          Choose a module
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Select where you want to work.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {MODULES.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} className="block">
                <Card className="h-full transition-colors hover:bg-muted/40">
                  <CardHeader>
                    <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-muted">
                      <Icon className="size-5" />
                    </div>
                    <CardTitle>{item.title}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </main>
  )
}

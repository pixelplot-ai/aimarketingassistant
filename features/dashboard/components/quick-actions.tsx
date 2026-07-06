import Link from "next/link"
import { CalendarDays, Plus, Settings } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Button
          className="w-full justify-start"
          nativeButton={false}
          render={<Link href="/posts/new" />}
        >
          <Plus className="size-4" />
          New Post
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start"
          nativeButton={false}
          render={<Link href="/calendar" />}
        >
          <CalendarDays className="size-4" />
          Content Calendar
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start"
          nativeButton={false}
          render={<Link href="/settings" />}
        >
          <Settings className="size-4" />
          Settings
        </Button>
      </CardContent>
    </Card>
  )
}

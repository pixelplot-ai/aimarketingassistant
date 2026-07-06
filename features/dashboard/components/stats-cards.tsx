import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  FileText,
  Layers,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { DashboardStats } from "@/features/dashboard/queries"

const statItems = [
  {
    key: "total" as const,
    label: "Total Posts",
    icon: Layers,
    className: "text-foreground",
  },
  {
    key: "draft" as const,
    label: "Drafts",
    icon: FileText,
    className: "text-muted-foreground",
  },
  {
    key: "scheduled" as const,
    label: "Scheduled",
    icon: CalendarClock,
    className: "text-blue-600 dark:text-blue-400",
  },
  {
    key: "published" as const,
    label: "Published",
    icon: CheckCircle2,
    className: "text-green-600 dark:text-green-400",
  },
  {
    key: "failed" as const,
    label: "Failed",
    icon: AlertCircle,
    className: "text-destructive",
  },
]

interface StatsCardsProps {
  stats: DashboardStats
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {statItems.map((item) => {
        const Icon = item.icon
        return (
          <Card key={item.key}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {item.label}
              </CardTitle>
              <Icon className={`size-4 ${item.className}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{stats[item.key]}</div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

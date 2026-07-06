import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Activity } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { RecentActivityItem } from "@/features/dashboard/queries"

interface RecentActivityProps {
  activity: RecentActivityItem[]
}

function getPublicationStatusVariant(
  status: RecentActivityItem["status"],
): "default" | "destructive" | "secondary" {
  return status === "success" ? "default" : "destructive"
}

export function RecentActivity({ activity }: RecentActivityProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No activity yet"
            description="Publication attempts will appear here once you publish posts."
            className="py-10"
          />
        ) : (
          <ul className="divide-y">
            {activity.map((item) => (
              <li key={item.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm">
                      <Link
                        href={`/posts/${item.post_id}/edit`}
                        className="font-medium hover:text-primary"
                      >
                        {item.post_title}
                      </Link>{" "}
                      <span className="text-muted-foreground">
                        on {item.platform_name}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(item.created_at), {
                        addSuffix: true,
                      })}
                      {item.error_message ? ` · ${item.error_message}` : null}
                    </p>
                  </div>
                  <Badge variant={getPublicationStatusVariant(item.status)}>
                    {item.status}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

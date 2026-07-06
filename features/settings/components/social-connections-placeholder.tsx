import { Link2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"
import {
  getPlatformBrandStyle,
  PlatformIconBadge,
} from "@/features/platforms/platform-icons"
import type { PlatformWithConnection } from "@/types/app"
import { cn } from "@/lib/utils"

interface SocialConnectionsPlaceholderProps {
  platforms: PlatformWithConnection[]
}

function getConnectionLabel(
  connection: PlatformWithConnection["connection"],
): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (!connection) {
    return { label: "Not connected", variant: "outline" }
  }

  switch (connection.status) {
    case "connected":
      return { label: "Connected", variant: "default" }
    case "expired":
      return { label: "Expired", variant: "destructive" }
    case "error":
      return { label: "Error", variant: "destructive" }
    default:
      return { label: "Disconnected", variant: "secondary" }
  }
}

export function SocialConnectionsPlaceholder({
  platforms,
}: SocialConnectionsPlaceholderProps) {
  if (platforms.length === 0) {
    return (
      <EmptyState
        icon={Link2}
        title="No platforms available"
        description="Enabled social platforms will appear here once configured in the database."
      />
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Social account connections arrive in Phase 8. Platform cards are loaded
        dynamically from your database.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {platforms.map((platform) => {
          const status = getConnectionLabel(platform.connection)
          const brand = getPlatformBrandStyle(platform.icon_key)

          return (
            <Card key={platform.id} className="overflow-hidden">
              <div className={cn("h-1 w-full", brand.iconBg)} />
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <PlatformIconBadge
                      platformKey={platform.icon_key}
                      size="lg"
                    />
                    <div>
                      <CardTitle>{platform.display_name}</CardTitle>
                      <CardDescription className="capitalize">
                        {platform.id}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-2 text-sm">
                {platform.connection?.account_name ? (
                  <p>
                    <span className="text-muted-foreground">Account: </span>
                    {platform.connection.account_name}
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    No account connected yet.
                  </p>
                )}

                {platform.connection?.token_expires_at ? (
                  <p>
                    <span className="text-muted-foreground">Token expires: </span>
                    {new Date(
                      platform.connection.token_expires_at,
                    ).toLocaleString()}
                  </p>
                ) : null}
              </CardContent>

              <CardFooter className="flex flex-wrap gap-2">
                <Button disabled>Connect</Button>
                <Button variant="outline" disabled>
                  Disconnect
                </Button>
                <Button variant="outline" disabled>
                  Refresh Token
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

"use client"

import { Link2, Loader2, RefreshCw, Unplug } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

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
  connectFacebookWithEnvToken,
  connectInstagramWithEnvPageToken,
  connectPlatform,
  disconnectPlatform,
  refreshConnection,
} from "@/features/integrations/actions"
import {
  getPlatformBrandStyle,
  PlatformIconBadge,
} from "@/features/platforms/platform-icons"
import type { PlatformWithConnection } from "@/types/app"
import { cn } from "@/lib/utils"

interface SocialConnectionsProps {
  platforms: PlatformWithConnection[]
  facebookEnvTokenAvailable?: boolean
}

function getConnectionLabel(
  connection: PlatformWithConnection["connection"],
): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (!connection || connection.status === "disconnected") {
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

function isConnected(connection: PlatformWithConnection["connection"]): boolean {
  return connection?.status === "connected"
}

export function SocialConnections({
  platforms,
  facebookEnvTokenAvailable = false,
}: SocialConnectionsProps) {
  const router = useRouter()
  const [loadingPlatform, setLoadingPlatform] = useState<string | null>(null)

  async function handleConnectWithEnvToken(platformId: "facebook" | "instagram") {
    setLoadingPlatform(platformId)

    const result =
      platformId === "facebook"
        ? await connectFacebookWithEnvToken()
        : await connectInstagramWithEnvPageToken()
    setLoadingPlatform(null)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    toast.success(
      platformId === "facebook"
        ? "Facebook Page connected via access token"
        : "Instagram connected via Facebook Page token",
    )
    router.refresh()
  }

  async function handleConnect(platformId: string) {
    setLoadingPlatform(platformId)

    const result = await connectPlatform(platformId)
    setLoadingPlatform(null)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    window.location.href = result.data.authUrl
  }

  async function handleDisconnect(platformId: string) {
    setLoadingPlatform(platformId)

    const result = await disconnectPlatform(platformId)
    setLoadingPlatform(null)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    toast.success("Platform disconnected")
    router.refresh()
  }

  async function handleRefresh(platformId: string) {
    setLoadingPlatform(platformId)

    const result = await refreshConnection(platformId)
    setLoadingPlatform(null)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    toast.success("Connection refreshed")
    router.refresh()
  }

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
        Connect your social accounts to publish posts.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {platforms.map((platform) => {
          const status = getConnectionLabel(platform.connection)
          const connected = isConnected(platform.connection)
          const isLoading = loadingPlatform === platform.id
          const usesEnvPageToken =
            (platform.id === "facebook" || platform.id === "instagram") &&
            facebookEnvTokenAvailable
          const brand = getPlatformBrandStyle(platform.icon_key)

          return (
            <Card
              key={platform.id}
              className={cn(
                "overflow-hidden transition-shadow hover:shadow-md",
                connected && "ring-1 ring-inset",
                connected && brand.ring,
              )}
            >
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
                {usesEnvPageToken ? (
                  <Button
                    disabled={isLoading}
                    onClick={() =>
                      void handleConnectWithEnvToken(
                        platform.id as "facebook" | "instagram",
                      )
                    }
                  >
                    {isLoading && !connected ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    {connected
                      ? "Reconnect token"
                      : platform.id === "instagram"
                        ? "Connect with page token"
                        : "Connect with access token"}
                  </Button>
                ) : (
                  <Button
                    disabled={isLoading}
                    onClick={() => handleConnect(platform.id)}
                  >
                    {isLoading && !connected ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    {connected ? "Reconnect" : "Connect"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={isLoading || !connected}
                  onClick={() => handleDisconnect(platform.id)}
                >
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Unplug className="size-4" />
                  )}
                  Disconnect
                </Button>
                <Button
                  variant="outline"
                  disabled={isLoading || !connected}
                  onClick={() => handleRefresh(platform.id)}
                >
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
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

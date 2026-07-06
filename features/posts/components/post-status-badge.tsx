import { cn } from "@/lib/utils"
import {
  formatPostStatus,
  getPostStatusStyles,
} from "@/features/posts/lib/post-status"
import type { Enums } from "@/types/database"

interface PostStatusBadgeProps {
  status: Enums<"post_status">
  className?: string
  showDot?: boolean
}

export function PostStatusBadge({
  status,
  className,
  showDot = true,
}: PostStatusBadgeProps) {
  const styles = getPostStatusStyles(status)

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles.badge,
        className,
      )}
    >
      {showDot ? (
        <span
          className={cn("size-1.5 shrink-0 rounded-full", styles.dot)}
          aria-hidden
        />
      ) : null}
      {formatPostStatus(status)}
    </span>
  )
}

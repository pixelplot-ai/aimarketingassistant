import { FileText, ImageIcon, Video } from "lucide-react"

import { cn } from "@/lib/utils"
import type { Enums } from "@/types/database"

export function PostMediaTypeBadge({
  mediaType,
}: {
  mediaType: Enums<"media_type">
}) {
  const config: Record<
    Enums<"media_type">,
    { label: string; icon: typeof FileText; className: string }
  > = {
    none: {
      label: "Text",
      icon: FileText,
      className: "border-border bg-muted/50 text-muted-foreground",
    },
    image: {
      label: "Image",
      icon: ImageIcon,
      className:
        "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-400",
    },
    video: {
      label: "Video",
      icon: Video,
      className:
        "border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
    },
  }

  const { label, icon: Icon, className } = config[mediaType]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      <Icon className="size-3" />
      {label}
    </span>
  )
}

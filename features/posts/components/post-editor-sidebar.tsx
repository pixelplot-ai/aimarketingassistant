import type { CSSProperties } from "react"
import {
  CheckCircle2,
  Circle,
  FileText,
  ImageIcon,
  Info,
  Rocket,
  Share2,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PostStatusBadge } from "@/features/posts/components/post-status-badge"
import { formatPostStatus } from "@/features/posts/lib/post-status"
import { cn } from "@/lib/utils"
import type { Enums } from "@/types/database"

interface PostEditorSidebarProps {
  currentStatus: Enums<"post_status">
  saveStatusPreview: Enums<"post_status">
  hasTitle: boolean
  hasContent: boolean
  platformCount: number
  hasMedia: boolean
  hasSchedule: boolean
}

function ChecklistItem({
  done,
  label,
  detail,
}: {
  done: boolean
  label: string
  detail?: string
}) {
  return (
    <li className="flex gap-2.5">
      {done ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
      )}
      <div className="min-w-0">
        <p
          className={cn(
            "text-sm font-medium",
            done ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {label}
        </p>
        {detail ? (
          <p className="text-xs text-muted-foreground">{detail}</p>
        ) : null}
      </div>
    </li>
  )
}

function getStatusHelp(status: Enums<"post_status">): string {
  switch (status) {
    case "draft":
      return "This post is saved but not queued for publishing. Add a future date to schedule it, or use Publish now."
    case "scheduled":
      return "This post will publish automatically at the scheduled date and time."
    case "publishing":
      return "Publication is in progress. Editing is disabled until it completes."
    case "published":
      return "This post was published. Saving changes updates the record but does not re-publish automatically."
    case "failed":
      return "Publishing failed. Fix any issues, then retry from the Posts list or use Publish now."
    case "cancelled":
      return "This post was cancelled and will not publish unless you schedule or publish it again."
    default:
      return ""
  }
}

export function PostEditorSidebar({
  currentStatus,
  saveStatusPreview,
  hasTitle,
  hasContent,
  platformCount,
  hasMedia,
  hasSchedule,
}: PostEditorSidebarProps) {
  const isPublishing = currentStatus === "publishing"
  const readyToPublish = hasTitle && hasContent && platformCount > 0

  return (
    <div className="space-y-4">
      <Card className="border-primary/10 bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Post overview</CardTitle>
          <CardDescription>Current state and what happens next.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current status
            </p>
            <PostStatusBadge status={currentStatus} />
            <p className="mt-2 text-sm text-muted-foreground">
              {getStatusHelp(currentStatus)}
            </p>
          </div>

          {!isPublishing && currentStatus !== "published" ? (
            <div className="rounded-lg border border-dashed p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                After save
              </p>
              <p className="mt-1 text-sm">
                Saving will mark this post as{" "}
                <span className="font-medium text-foreground">
                  {formatPostStatus(saveStatusPreview)}
                </span>
                {saveStatusPreview === "scheduled" && hasSchedule
                  ? " based on your scheduled date."
                  : saveStatusPreview === "draft"
                    ? " because no future date is set."
                    : "."}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Readiness</CardTitle>
          <CardDescription>
            {readyToPublish
              ? "Ready to schedule or publish."
              : "Complete the items below before publishing."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <ChecklistItem
              done={hasTitle}
              label="Title"
              detail={hasTitle ? "Added" : "Required for identification"}
            />
            <ChecklistItem
              done={hasContent}
              label="Caption / text"
              detail={
                hasContent ? "Content added" : "Write or generate post text"
              }
            />
            <ChecklistItem
              done={platformCount > 0}
              label="Platforms"
              detail={
                platformCount > 0
                  ? `${platformCount} selected`
                  : "Select at least one platform"
              }
            />
            <ChecklistItem
              done={hasMedia}
              label="Media"
              detail={
                hasMedia ? "Image or video attached" : "Optional — text-only OK"
              }
            />
            <ChecklistItem
              done={hasSchedule}
              label="Schedule"
              detail={
                hasSchedule
                  ? "Future date set — saves as Scheduled"
                  : "Optional — leave empty for Draft"
              }
            />
          </ul>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Actions guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex gap-2.5">
            <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">Save changes</p>
              <p className="text-muted-foreground">
                Updates the post. With post text, a platform, and a future date,
                saving schedules automatic publication.
              </p>
            </div>
          </div>
          <div className="flex gap-2.5">
            <Rocket className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="font-medium">Publish now</p>
              <p className="text-muted-foreground">
                Saves and publishes immediately to all selected platforms.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {isPublishing ? (
        <Alert>
          <Info className="size-4" />
          <AlertTitle>Publishing in progress</AlertTitle>
          <AlertDescription>
            Publish now is disabled until this completes.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}

export function PostEditorSectionIcon({
  icon: Icon,
  className,
  style,
}: {
  icon: typeof FileText
  className?: string
  style?: CSSProperties
}) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/50 [&>svg]:size-4",
        className,
      )}
      style={style}
    >
      <Icon className="size-4" />
    </span>
  )
}

export function PostEditorSectionHeader({
  icon,
  title,
  description,
  iconClassName,
  iconStyle,
}: {
  icon: typeof FileText
  title: string
  description?: string
  iconClassName?: string
  iconStyle?: CSSProperties
}) {
  return (
    <div className="flex items-start gap-3.5">
      <PostEditorSectionIcon
        icon={icon}
        className={cn(
          "size-10 rounded-xl border-foreground/10 bg-background shadow-sm [&>svg]:size-[18px]",
          iconClassName,
        )}
        style={iconStyle}
      />
      <div className="min-w-0 pt-0.5">
        <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm leading-snug text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export { ImageIcon, Share2 }

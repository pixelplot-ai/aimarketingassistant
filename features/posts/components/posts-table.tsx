"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { format } from "date-fns"
import { formatInTimeZone } from "date-fns-tz"
import {
  Copy,
  FileText,
  ImageIcon,
  Loader2,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
  Video,
} from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  deletePost,
  duplicatePost,
  retryFailedPost,
  type ListPostsResult,
} from "@/features/posts/actions"
import { PostStatusBadge } from "@/features/posts/components/post-status-badge"
import { PlatformChip } from "@/features/platforms/platform-icons"
import { cn } from "@/lib/utils"
import type { Enums } from "@/types/database"

interface PostsTableProps {
  data: ListPostsResult
}

function MediaTypeBadge({ mediaType }: { mediaType: Enums<"media_type"> }) {
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

export function PostsTable({ data }: PostsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (page <= 1) {
      params.delete("page")
    } else {
      params.set("page", String(page))
    }

    startTransition(() => {
      router.push(`/posts?${params.toString()}`)
    })
  }

  async function handleDuplicate(postId: string) {
    setLoadingAction(postId)
    const result = await duplicatePost(postId)
    setLoadingAction(null)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    toast.success("Post duplicated")
    router.push(`/posts/${result.data.id}/edit`)
  }

  async function handleRetry(postId: string) {
    setLoadingAction(postId)
    const result = await retryFailedPost(postId)
    setLoadingAction(null)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    toast.success("Retrying publication…")
    router.refresh()
  }

  async function handleDelete() {
    if (!deleteId) {
      return
    }

    setLoadingAction(deleteId)
    const result = await deletePost(deleteId)
    setLoadingAction(null)
    setDeleteId(null)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    toast.success("Post deleted")
    router.refresh()
  }

  if (data.posts.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No posts found"
        description="Try adjusting your filters or create a new post."
        action={
          <Button nativeButton={false} render={<Link href="/posts/new" />}>
            Create post
          </Button>
        }
      />
    )
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
          <p className="text-sm font-medium">
            {data.total} {data.total === 1 ? "post" : "posts"}
          </p>
          {data.totalPages > 1 ? (
            <p className="text-xs text-muted-foreground">
              Page {data.page} of {data.totalPages}
            </p>
          ) : null}
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20 hover:bg-muted/20">
              <TableHead className="font-semibold">Title</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Platforms</TableHead>
              <TableHead className="font-semibold">Media</TableHead>
              <TableHead className="font-semibold">Scheduled</TableHead>
              <TableHead className="font-semibold">Updated</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.posts.map((post) => (
              <TableRow
                key={post.id}
                className="group cursor-pointer transition-colors hover:bg-muted/30"
                onClick={() => router.push(`/posts/${post.id}/edit`)}
              >
                <TableCell className="max-w-xs">
                  <p className="truncate font-medium text-foreground transition-colors group-hover:text-primary">
                    {post.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {post.content || "No content"}
                  </p>
                </TableCell>
                <TableCell>
                  <PostStatusBadge status={post.status} />
                </TableCell>
                <TableCell>
                  {post.platform_names.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {post.platform_names.map((name, index) => (
                        <PlatformChip
                          key={`${post.id}-${name}`}
                          platformKey={
                            post.platform_icon_keys[index] ??
                            post.platform_ids[index] ??
                            name
                          }
                          label={name}
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <MediaTypeBadge mediaType={post.media_type} />
                </TableCell>
                <TableCell className="text-sm">
                  {post.scheduled_at ? (
                    <span className="text-sky-700 dark:text-sky-400">
                      {formatInTimeZone(
                        post.scheduled_at,
                        post.timezone,
                        "MMM d, yyyy h:mm a",
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell
                  className="text-sm text-muted-foreground"
                  onClick={(event) => event.stopPropagation()}
                >
                  {format(new Date(post.updated_at), "MMM d, yyyy")}
                </TableCell>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Open post actions"
                        />
                      }
                    >
                      {loadingAction === post.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <MoreHorizontal className="size-4" />
                      )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        nativeButton={false}
                        render={<Link href={`/posts/${post.id}/edit`} />}
                      >
                        <Pencil className="size-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => void handleDuplicate(post.id)}
                      >
                        <Copy className="size-4" />
                        Duplicate
                      </DropdownMenuItem>
                      {post.status === "failed" ? (
                        <DropdownMenuItem
                          onClick={() => void handleRetry(post.id)}
                        >
                          <RefreshCw className="size-4" />
                          Retry publish
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteId(post.id)}
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data.totalPages > 1 ? (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Showing {(data.page - 1) * data.pageSize + 1}–
            {Math.min(data.page * data.pageSize, data.total)} of {data.total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isPending || data.page <= 1}
              onClick={() => goToPage(data.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending || data.page >= data.totalPages}
              onClick={() => goToPage(data.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteId(null)
          }
        }}
        title="Delete post"
        description="This post will be moved to trash. You can create a new one anytime."
        confirmLabel="Delete"
        variant="destructive"
        loading={loadingAction !== null}
        onConfirm={handleDelete}
      />
    </>
  )
}

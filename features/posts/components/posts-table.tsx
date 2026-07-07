"use client"

import Link from "next/link"
import { format } from "date-fns"
import { formatInTimeZone } from "date-fns-tz"
import { FileText } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ListPostsResult } from "@/features/posts/actions"
import { PostMediaTypeBadge } from "@/features/posts/components/post-media-type-badge"
import { PostStatusBadge } from "@/features/posts/components/post-status-badge"
import {
  PostActionsMenu,
  PostsDeleteDialog,
  PostsListPagination,
  usePostsListActions,
} from "@/features/posts/components/use-posts-list-actions"
import { PlatformChip } from "@/features/platforms/platform-icons"

interface PostsTableProps {
  data: ListPostsResult
}

export function PostsTable({ data }: PostsTableProps) {
  const {
    router,
    isPending,
    deleteId,
    setDeleteId,
    loadingAction,
    goToPage,
    handleDuplicate,
    handleRetry,
    handleDelete,
  } = usePostsListActions()

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
                  <PostMediaTypeBadge mediaType={post.media_type} />
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
                  <PostActionsMenu
                    postId={post.id}
                    status={post.status}
                    loadingAction={loadingAction}
                    onDuplicate={(id) => void handleDuplicate(id)}
                    onRetry={(id) => void handleRetry(id)}
                    onDelete={setDeleteId}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PostsListPagination
        data={data}
        isPending={isPending}
        onPageChange={goToPage}
      />

      <PostsDeleteDialog
        deleteId={deleteId}
        loadingAction={loadingAction}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteId(null)
          }
        }}
        onConfirm={() => void handleDelete()}
      />
    </>
  )
}

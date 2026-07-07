"use client"

import Link from "next/link"
import { format } from "date-fns"
import { formatInTimeZone } from "date-fns-tz"
import { CalendarClock, FileText } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card"
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

interface PostsGridProps {
  data: ListPostsResult
}

export function PostsGrid({ data }: PostsGridProps) {
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

        <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {data.posts.map((post) => (
            <Card
              key={post.id}
              className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
              onClick={() => router.push(`/posts/${post.id}/edit`)}
            >
              <CardHeader className="space-y-3 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <PostStatusBadge status={post.status} />
                  <div onClick={(event) => event.stopPropagation()}>
                    <PostActionsMenu
                      postId={post.id}
                      status={post.status}
                      loadingAction={loadingAction}
                      onDuplicate={(id) => void handleDuplicate(id)}
                      onRetry={(id) => void handleRetry(id)}
                      onDelete={setDeleteId}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="line-clamp-2 font-semibold leading-snug transition-colors group-hover:text-primary">
                    {post.title}
                  </h3>
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {post.content || "No content"}
                  </p>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <PostMediaTypeBadge mediaType={post.media_type} />
                  {post.platform_names.length > 0 ? (
                    post.platform_names.map((name, index) => (
                      <PlatformChip
                        key={`${post.id}-${name}`}
                        platformKey={
                          post.platform_icon_keys[index] ??
                          post.platform_ids[index] ??
                          name
                        }
                        label={name}
                      />
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      No platforms
                    </span>
                  )}
                </div>

                {post.scheduled_at ? (
                  <p className="flex items-center gap-1.5 text-xs text-sky-700 dark:text-sky-400">
                    <CalendarClock className="size-3.5 shrink-0" />
                    {formatInTimeZone(
                      post.scheduled_at,
                      post.timezone,
                      "MMM d, yyyy h:mm a",
                    )}
                  </p>
                ) : null}
              </CardContent>

              <CardFooter className="border-t bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
                Updated {format(new Date(post.updated_at), "MMM d, yyyy")}
              </CardFooter>
            </Card>
          ))}
        </div>
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

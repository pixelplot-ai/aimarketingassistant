"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Copy, Loader2, MoreHorizontal, Pencil, RefreshCw, Trash2 } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  deletePost,
  duplicatePost,
  retryFailedPost,
  type ListPostsResult,
} from "@/features/posts/actions"
import type { Enums } from "@/types/database"

export function usePostsListActions() {
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

  return {
    router,
    isPending,
    deleteId,
    setDeleteId,
    loadingAction,
    goToPage,
    handleDuplicate,
    handleRetry,
    handleDelete,
  }
}

export function PostActionsMenu({
  postId,
  status,
  loadingAction,
  onDuplicate,
  onRetry,
  onDelete,
}: {
  postId: string
  status: Enums<"post_status">
  loadingAction: string | null
  onDuplicate: (postId: string) => void
  onRetry: (postId: string) => void
  onDelete: (postId: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Open post actions" />
        }
      >
        {loadingAction === postId ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <MoreHorizontal className="size-4" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          nativeButton={false}
          render={<Link href={`/posts/${postId}/edit`} />}
        >
          <Pencil className="size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDuplicate(postId)}>
          <Copy className="size-4" />
          Duplicate
        </DropdownMenuItem>
        {status === "failed" ? (
          <DropdownMenuItem onClick={() => onRetry(postId)}>
            <RefreshCw className="size-4" />
            Retry publish
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(postId)}>
          <Trash2 className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function PostsListPagination({
  data,
  isPending,
  onPageChange,
}: {
  data: ListPostsResult
  isPending: boolean
  onPageChange: (page: number) => void
}) {
  if (data.totalPages <= 1) {
    return null
  }

  return (
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
          onClick={() => onPageChange(data.page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isPending || data.page >= data.totalPages}
          onClick={() => onPageChange(data.page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}

export function PostsDeleteDialog({
  deleteId,
  loadingAction,
  onOpenChange,
  onConfirm,
}: {
  deleteId: string | null
  loadingAction: string | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <ConfirmDialog
      open={deleteId !== null}
      onOpenChange={onOpenChange}
      title="Delete post"
      description="This post will be moved to trash. You can create a new one anytime."
      confirmLabel="Delete"
      variant="destructive"
      loading={loadingAction !== null}
      onConfirm={onConfirm}
    />
  )
}

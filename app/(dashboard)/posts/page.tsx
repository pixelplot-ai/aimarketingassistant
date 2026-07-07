import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { PageHeader } from "@/components/layout/page-header"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { Button } from "@/components/ui/button"
import { getPlatforms, listPosts } from "@/features/posts/actions"
import { PostsFilters } from "@/features/posts/components/posts-filters"
import { PostsView } from "@/features/posts/components/posts-view"
import type { PostFilterValues } from "@/lib/validations/post"

export const metadata: Metadata = {
  title: "Posts",
}

interface PostsPageProps {
  searchParams: Promise<Partial<Record<keyof PostFilterValues, string>>>
}

export default async function PostsPage({ searchParams }: PostsPageProps) {
  const params = await searchParams
  const filters: Partial<PostFilterValues> = {
    search: params.search,
    status: params.status as PostFilterValues["status"],
    media_type: params.media_type as PostFilterValues["media_type"],
    platform_id: params.platform_id,
    date_from: params.date_from,
    date_to: params.date_to,
    sort_by: params.sort_by as PostFilterValues["sort_by"],
    sort_order: params.sort_order as PostFilterValues["sort_order"],
    page: params.page ? Number(params.page) : undefined,
    page_size: params.page_size ? Number(params.page_size) : undefined,
  }

  const [postsResult, platformsResult] = await Promise.all([
    listPosts(filters),
    getPlatforms(),
  ])

  if (!postsResult.success) {
    throw new Error(postsResult.error)
  }

  const platforms = platformsResult.success ? platformsResult.data : []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Posts"
        description="Create, filter, and manage your social media posts."
        actions={
          <Button nativeButton={false} render={<Link href="/posts/new" />}>
            New Post
          </Button>
        }
      />

      <Suspense fallback={<LoadingSkeleton variant="card" />}>
        <PostsFilters platforms={platforms} />
      </Suspense>

      <PostsView data={postsResult.data} />
    </div>
  )
}

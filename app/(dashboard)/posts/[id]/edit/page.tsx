import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { formatScheduleDisplay } from "@/features/calendar/lib/datetime"
import { ArrowLeft } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { getBrandProfile } from "@/features/brand/actions"
import { getPlatforms, getPost } from "@/features/posts/actions"
import { PostEditor } from "@/features/posts/components/post-editor"
import { PostStatusBadge } from "@/features/posts/components/post-status-badge"
import { getPostMedia } from "@/features/posts/media-actions"
import { getProducts } from "@/features/products/actions"
import { getActiveCampaign } from "@/features/marketing-strategy/actions"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const postResult = await getPost(id)

  if (!postResult.success) {
    return { title: "Edit Post" }
  }

  return {
    title: `Edit: ${postResult.data.title}`,
  }
}

interface EditPostPageProps {
  params: Promise<{ id: string }>
}

export default async function EditPostPage({ params }: EditPostPageProps) {
  const { id } = await params
  const [postResult, platformsResult, brandResult, mediaResult, productsResult, activeCampaignResult] =
    await Promise.all([
      getPost(id),
      getPlatforms(),
      getBrandProfile(),
      getPostMedia(id),
      getProducts(),
      getActiveCampaign(),
    ])

  if (!postResult.success) {
    if (postResult.error === "Post not found.") {
      notFound()
    }

    if (postResult.error === "You must be signed in to continue.") {
      redirect("/login")
    }

    throw new Error(postResult.error)
  }

  const platforms = platformsResult.success ? platformsResult.data : []
  const post = postResult.data
  const brandProfile = brandResult.success ? brandResult.data : null
  const postMedia = mediaResult.success ? mediaResult.data : null
  const products = productsResult.success ? productsResult.data : []
  const activeCampaign = activeCampaignResult.success
    ? activeCampaignResult.data
    : null

  const scheduleHint = post.scheduled_at
    ? `Scheduled for ${formatScheduleDisplay(post.scheduled_at, post.timezone)} (${post.timezone})`
    : "Not scheduled — saves as draft until you set a future date."

  return (
    <div className="space-y-6">
      <PageHeader
        title={post.title}
        description={`Edit content, media, platforms, and schedule. ${scheduleHint}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PostStatusBadge status={post.status} />
            <Button
              nativeButton={false}
              variant="outline"
              size="sm"
              render={<Link href="/posts" />}
            >
              <ArrowLeft className="size-4" />
              All posts
            </Button>
          </div>
        }
      />
      <PostEditor
        mode="edit"
        postId={post.id}
        platforms={platforms}
        brandProfileComplete={brandProfile?.is_complete ?? false}
        initialMedia={postMedia}
        initialValues={{
          title: post.title,
          content: post.content,
          media_type: post.media_type,
          scheduled_at: post.scheduled_at,
          timezone: post.timezone,
          platform_ids: post.platform_ids,
          brand_profile_id: post.brand_profile_id ?? brandProfile?.id ?? null,
        }}
        currentStatus={post.status}
        products={products}
        activeCampaign={activeCampaign}
      />
    </div>
  )
}

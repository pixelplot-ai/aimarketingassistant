import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ArrowRight, FileText } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { RecentPost } from "@/features/dashboard/queries"
import { PostStatusBadge } from "@/features/posts/components/post-status-badge"

interface RecentPostsProps {
  posts: RecentPost[]
}

export function RecentPosts({ posts }: RecentPostsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Posts</CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/posts" />}
          >
            View all
            <ArrowRight className="size-4" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {posts.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No posts yet"
            description="Create your first post to see it here."
            className="py-10"
            action={
              <Button nativeButton={false} render={<Link href="/posts/new" />}>
                Create post
              </Button>
            }
          />
        ) : (
          <ul className="divide-y">
            {posts.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/posts/${post.id}/edit`}
                  className="flex items-center justify-between gap-4 py-3 transition-colors hover:text-primary"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{post.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Updated{" "}
                      {formatDistanceToNow(new Date(post.updated_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <PostStatusBadge status={post.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

"use client"

import { LayoutGrid, List } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import type { ListPostsResult } from "@/features/posts/actions"
import { PostsGrid } from "@/features/posts/components/posts-grid"
import { PostsTable } from "@/features/posts/components/posts-table"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "posts-view-mode"

export type PostsViewMode = "grid" | "list"

interface PostsViewProps {
  data: ListPostsResult
}

function readStoredViewMode(): PostsViewMode {
  if (typeof window === "undefined") {
    return "list"
  }

  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === "grid" ? "grid" : "list"
}

export function PostsView({ data }: PostsViewProps) {
  const [viewMode, setViewMode] = useState<PostsViewMode>("list")
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setViewMode(readStoredViewMode())
    setHydrated(true)
  }, [])

  function switchView(mode: PostsViewMode) {
    setViewMode(mode)
    localStorage.setItem(STORAGE_KEY, mode)
  }

  const activeView = hydrated ? viewMode : "list"

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="inline-flex rounded-lg border bg-muted/30 p-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "gap-1.5 rounded-md",
              activeView === "list" && "bg-background shadow-sm",
            )}
            aria-pressed={activeView === "list"}
            onClick={() => switchView("list")}
          >
            <List className="size-4" />
            List
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "gap-1.5 rounded-md",
              activeView === "grid" && "bg-background shadow-sm",
            )}
            aria-pressed={activeView === "grid"}
            onClick={() => switchView("grid")}
          >
            <LayoutGrid className="size-4" />
            Grid
          </Button>
        </div>
      </div>

      {activeView === "grid" ? (
        <PostsGrid data={data} />
      ) : (
        <PostsTable data={data} />
      )}
    </div>
  )
}

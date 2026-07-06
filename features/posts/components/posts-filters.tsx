"use client"

import { ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState, useTransition } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { POST_STATUSES } from "@/features/posts/lib/post-status"
import { PostStatusBadge } from "@/features/posts/components/post-status-badge"
import { PlatformIconBadge } from "@/features/platforms/platform-icons"
import type { Tables } from "@/types/database"

interface PostsFiltersProps {
  platforms: Tables<"platforms">[]
}

function countActiveFilters(values: {
  search: string
  status: string
  media_type: string
  platform_id: string
  date_from: string
  date_to: string
  sort_by: string
  sort_order: string
}): number {
  let count = 0
  if (values.search.trim()) count++
  if (values.status !== "all") count++
  if (values.media_type !== "all") count++
  if (values.platform_id !== "all") count++
  if (values.date_from) count++
  if (values.date_to) count++
  if (values.sort_by !== "created_at") count++
  if (values.sort_order !== "desc") count++
  return count
}

export function PostsFilters({ platforms }: PostsFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const currentValues = {
    search: searchParams.get("search") ?? "",
    status: searchParams.get("status") ?? "all",
    media_type: searchParams.get("media_type") ?? "all",
    platform_id: searchParams.get("platform_id") ?? "all",
    date_from: searchParams.get("date_from") ?? "",
    date_to: searchParams.get("date_to") ?? "",
    sort_by: searchParams.get("sort_by") ?? "created_at",
    sort_order: searchParams.get("sort_order") ?? "desc",
  }

  const activeFilterCount = useMemo(
    () => countActiveFilters(currentValues),
    [currentValues],
  )

  const [expanded, setExpanded] = useState(activeFilterCount > 0)

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())

    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === "all") {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }

    if (!updates.page) {
      params.delete("page")
    }

    startTransition(() => {
      router.push(`/posts?${params.toString()}`)
    })
  }

  function handleReset() {
    startTransition(() => {
      router.push("/posts")
    })
  }

  function applySearch() {
    const searchInput = document.getElementById(
      "posts-search",
    ) as HTMLInputElement | null
    updateParams({ search: searchInput?.value ?? "" })
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-2 bg-muted/30 p-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Input
            id="posts-search"
            placeholder="Search title or content..."
            defaultValue={currentValues.search}
            className="max-w-md"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                applySearch()
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={applySearch}
          >
            Search
          </Button>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
        >
          <SlidersHorizontal className="size-4" />
          Filters
          {activeFilterCount > 0 ? (
            <Badge variant="secondary" className="ml-1 px-1.5">
              {activeFilterCount}
            </Badge>
          ) : null}
          {expanded ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </Button>

        {activeFilterCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={handleReset}
          >
            Reset
          </Button>
        ) : null}
      </div>

      {expanded ? (
        <div className="space-y-4 border-t bg-muted/10 px-4 pb-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={currentValues.status}
                onValueChange={(value) => updateParams({ status: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {POST_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      <span className="flex items-center gap-2">
                        <PostStatusBadge
                          status={status}
                          className="pointer-events-none scale-90"
                        />
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Media type</Label>
              <Select
                value={currentValues.media_type}
                onValueChange={(value) => updateParams({ media_type: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All media types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All media types</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Platform</Label>
              <Select
                value={currentValues.platform_id}
                onValueChange={(value) => updateParams({ platform_id: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All platforms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All platforms</SelectItem>
                  {platforms.map((platform) => (
                    <SelectItem key={platform.id} value={platform.id}>
                      <span className="flex items-center gap-2">
                        <PlatformIconBadge
                          platformKey={platform.icon_key}
                          size="sm"
                        />
                        {platform.display_name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_from">From date</Label>
              <Input
                id="date_from"
                type="date"
                defaultValue={currentValues.date_from}
                onChange={(event) =>
                  updateParams({ date_from: event.target.value || null })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_to">To date</Label>
              <Input
                id="date_to"
                type="date"
                defaultValue={currentValues.date_to}
                onChange={(event) =>
                  updateParams({ date_to: event.target.value || null })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Sort by</Label>
              <Select
                value={currentValues.sort_by}
                onValueChange={(value) => updateParams({ sort_by: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Created</SelectItem>
                  <SelectItem value="updated_at">Updated</SelectItem>
                  <SelectItem value="scheduled_at">Scheduled</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sort order</Label>
              <Select
                value={currentValues.sort_order}
                onValueChange={(value) => updateParams({ sort_order: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Newest first</SelectItem>
                  <SelectItem value="asc">Oldest first</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

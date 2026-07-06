import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface LoadingSkeletonProps {
  variant?: "page" | "card" | "table"
  className?: string
}

export function LoadingSkeleton({
  variant = "page",
  className,
}: LoadingSkeletonProps) {
  if (variant === "card") {
    return (
      <div className={cn("space-y-4 rounded-xl border p-6", className)}>
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (variant === "table") {
    return (
      <div className={cn("space-y-3", className)}>
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-3 rounded-xl border p-6">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

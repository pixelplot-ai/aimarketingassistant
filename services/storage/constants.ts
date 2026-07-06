export type StorageBucket = "images" | "videos" | "generated-images" | "product-images"

export type BucketConfig = {
  acceptedTypes: readonly string[]
  maxBytes: number
}

export const BUCKET_CONFIG: Record<StorageBucket, BucketConfig> = {
  images: {
    acceptedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    maxBytes: 10 * 1024 * 1024,
  },
  videos: {
    acceptedTypes: ["video/mp4", "video/quicktime", "video/webm"],
    maxBytes: 100 * 1024 * 1024,
  },
  "generated-images": {
    acceptedTypes: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: 15 * 1024 * 1024,
  },
  "product-images": {
    acceptedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    maxBytes: 10 * 1024 * 1024,
  },
}

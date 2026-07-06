"use client"

import {
  Download,
  ImagePlus,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  Video,
} from "lucide-react"
import Link from "next/link"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  generatePostImage,
  getPostMediaDownloadUrl,
  removePostMedia,
  uploadPostImage,
  uploadPostVideo,
  type PostMediaWithUrl,
} from "@/features/posts/media-actions"
import type { ImageAspectRatio } from "@/services/ai/types"
import { BUCKET_CONFIG } from "@/services/storage/constants"

const ASPECT_RATIO_OPTIONS: { value: ImageAspectRatio; label: string }[] = [
  { value: "square", label: "Square (1024×1024)" },
  { value: "portrait", label: "Portrait (864×1184)" },
  { value: "landscape", label: "Landscape (1184×864)" },
]

export type ProductContextForMedia = {
  name: string
  description?: string | null
  imageStoragePath?: string | null
}

interface MediaSectionProps {
  postId?: string
  postContent?: string
  brandProfileComplete: boolean
  initialMedia?: PostMediaWithUrl | null
  mediaType: "none" | "image" | "video"
  onMediaTypeChange: (value: "none" | "image" | "video") => void
  productContext?: ProductContextForMedia | null
}

export function MediaSection({
  postId,
  postContent = "",
  brandProfileComplete,
  initialMedia = null,
  mediaType,
  onMediaTypeChange,
  productContext,
}: MediaSectionProps) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const [media, setMedia] = useState<PostMediaWithUrl | null>(initialMedia)
  const [isUploading, setIsUploading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false)
  const [imagePrompt, setImagePrompt] = useState("")
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>("square")

  const hasPost = Boolean(postId)
  const isVideo = media?.media_type === "uploaded_video"

  async function handleImageUpload(file: File) {
    if (!postId) {
      return
    }

    setIsUploading(true)
    const formData = new FormData()
    formData.set("file", file)

    const result = await uploadPostImage(postId, formData)
    setIsUploading(false)

    if (!result.success) {
      toast.error(result.error ?? "Image upload failed.")
      return
    }

    setMedia(result.data)
    onMediaTypeChange("image")
    toast.success("Image uploaded.")
  }

  async function handleVideoUpload(file: File) {
    if (!postId) {
      return
    }

    setIsUploading(true)
    const formData = new FormData()
    formData.set("file", file)

    const result = await uploadPostVideo(postId, formData)
    setIsUploading(false)

    if (!result.success) {
      toast.error(result.error ?? "Video upload failed.")
      return
    }

    setMedia(result.data)
    onMediaTypeChange("video")
    toast.success("Video uploaded.")
  }

  async function handleGenerateImage() {
    if (!postId) {
      return
    }

    const trimmedContent = postContent.trim()
    const trimmedPrompt = imagePrompt.trim()

    if (!trimmedContent && !trimmedPrompt) {
      toast.error("Add post content or an additional image direction first.")
      return
    }

    setIsGenerating(true)
    console.log("[post-image] client: generating with product context", {
      postId,
      productName: productContext?.name ?? null,
      productImageStoragePath: productContext?.imageStoragePath ?? null,
    })
    const result = await generatePostImage({
      postId,
      prompt: trimmedPrompt,
      postContent: trimmedContent,
      aspectRatio,
      productContext: productContext
        ? { name: productContext.name, description: productContext.description }
        : null,
      productImageStoragePath: productContext?.imageStoragePath ?? null,
    })
    setIsGenerating(false)

    if (!result.success) {
      toast.error(result.error ?? "Image generation failed.")
      return
    }

    setMedia(result.data)
    onMediaTypeChange("image")
    setGenerateDialogOpen(false)
    setImagePrompt("")
    toast.success("AI image generated.")
  }

  async function handleRemove() {
    if (!postId) {
      return
    }

    setIsRemoving(true)
    const result = await removePostMedia(postId)
    setIsRemoving(false)

    if (!result.success) {
      toast.error(result.error ?? "Failed to remove media.")
      return
    }

    setMedia(null)
    onMediaTypeChange("none")
    toast.success("Media removed.")
  }

  async function handleDownload() {
    if (!postId) {
      return
    }

    const result = await getPostMediaDownloadUrl(postId)

    if (!result.success) {
      toast.error(result.error ?? "Download failed.")
      return
    }

    const anchor = document.createElement("a")
    anchor.href = result.data.url
    anchor.download = result.data.fileName
    anchor.target = "_blank"
    anchor.rel="noopener noreferrer"
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  }

  if (!hasPost) {
    return (
      <Alert>
        <Upload className="size-4" />
        <AlertTitle>Save post to add media</AlertTitle>
        <AlertDescription>
          Create or save this post first, then return to the edit page to upload
          or generate media.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {media && media.signedUrl ? (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border bg-muted/20">
            {isVideo ? (
              <video
                src={media.signedUrl}
                controls
                className="max-h-80 w-full object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={media.signedUrl}
                alt="Post media"
                className="max-h-80 w-full object-contain"
              />
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {!isVideo ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploading || isGenerating}
                  onClick={() => imageInputRef.current?.click()}
                >
                  {isUploading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="size-3.5" />
                  )}
                  Replace image
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploading || isGenerating}
                  onClick={() => setGenerateDialogOpen(true)}
                >
                  <Sparkles className="size-3.5" />
                  Regenerate
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploading}
                onClick={() => videoInputRef.current?.click()}
              >
                {isUploading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Video className="size-3.5" />
                )}
                Replace video
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownload}
            >
              <Download className="size-3.5" />
              Download
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isRemoving}
              onClick={handleRemove}
            >
              {isRemoving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              Remove
            </Button>
          </div>

          {media.media_type === "generated_image" ? (
            <p className="text-xs text-muted-foreground">AI-generated image</p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Button
            type="button"
            variant="outline"
            className="h-auto flex-col gap-2 py-6"
            disabled={isUploading || isGenerating}
            onClick={() => imageInputRef.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <ImagePlus className="size-5" />
            )}
            <span>Upload image</span>
            <span className="text-xs font-normal text-muted-foreground">
              Max {Math.round(BUCKET_CONFIG.images.maxBytes / (1024 * 1024))} MB
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-auto flex-col gap-2 py-6"
            disabled={isUploading || isGenerating}
            onClick={() => setGenerateDialogOpen(true)}
          >
            <Sparkles className="size-5" />
            <span>Generate AI image</span>
            <span className="text-xs font-normal text-muted-foreground">
              Powered by Gemini
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-auto flex-col gap-2 py-6"
            disabled={isUploading || isGenerating}
            onClick={() => videoInputRef.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Video className="size-5" />
            )}
            <span>Upload video</span>
            <span className="text-xs font-normal text-muted-foreground">
              Max {Math.round(BUCKET_CONFIG.videos.maxBytes / (1024 * 1024))} MB
            </span>
          </Button>
        </div>
      )}

      {!brandProfileComplete ? (
        <Alert>
          <Sparkles className="size-4" />
          <AlertTitle>Brand profile recommended</AlertTitle>
          <AlertDescription>
            AI images work without a brand profile, but results improve when
            you{" "}
            <Link href="/settings" className="font-medium underline">
              configure your Brand Profile
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : null}

      <input
        ref={imageInputRef}
        type="file"
        accept={BUCKET_CONFIG.images.acceptedTypes.join(",")}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            void handleImageUpload(file)
          }
          event.target.value = ""
        }}
      />

      <input
        ref={videoInputRef}
        type="file"
        accept={BUCKET_CONFIG.videos.acceptedTypes.join(",")}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            void handleVideoUpload(file)
          }
          event.target.value = ""
        }}
      />

      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate AI image</DialogTitle>
            <DialogDescription>
              The image is generated from your post caption. Add optional extra
              direction below. Brand colors and style from your profile are
              applied automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {productContext && (
              <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                <span className="font-medium text-primary">Product:</span>
                <span className="text-foreground">{productContext.name}</span>
                {productContext.imageStoragePath && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    (image included as reference)
                  </span>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Post content used for the image</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {postContent.trim() ? (
                  <p className="whitespace-pre-wrap text-foreground">
                    {postContent.trim()}
                  </p>
                ) : (
                  "No post content yet — write your caption above or add direction below."
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="image-prompt">
                Additional image direction{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="image-prompt"
                rows={3}
                value={imagePrompt}
                onChange={(event) => setImagePrompt(event.target.value)}
                placeholder="e.g. Warm lighting, product close-up, minimal background"
              />
            </div>

            <div className="space-y-2">
              <Label>Aspect ratio</Label>
              <Select
                value={aspectRatio}
                onValueChange={(value) => {
                  if (value) {
                    setAspectRatio(value as ImageAspectRatio)
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIO_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setGenerateDialogOpen(false)}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleGenerateImage}
              disabled={
                isGenerating || (!postContent.trim() && !imagePrompt.trim())
              }
            >
              {isGenerating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {mediaType === "none" && !media ? (
        <p className="text-sm text-muted-foreground">
          Add an image or video to accompany your post text.
        </p>
      ) : null}
    </div>
  )
}

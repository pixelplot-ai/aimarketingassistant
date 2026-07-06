"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useTransition, useState, useRef, useEffect } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
  Globe,
  ImageOff,
  ImagePlus,
  Loader2,
  Sparkles,
  Upload,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  extractFromUrl,
  createProduct,
  updateProduct,
  uploadProductImage,
  type ExtractResult,
  type ProductRow,
} from "@/features/products/actions"
import {
  extractProductSchema,
  productFormSchema,
  PRODUCT_TYPE_LABELS,
  type ProductType,
  type ProductFormValues,
  type ExtractProductValues,
} from "@/lib/validations/product"

interface ProductFormProps {
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  product?: ProductRow
  /** Signed URL for the product's stored image (edit mode). */
  initialImageUrl?: string | null
}

type EntryMode = "url" | "manual"
type FormStep = "input" | "preview"

export function ProductForm({
  trigger,
  open,
  onOpenChange,
  product,
  initialImageUrl,
}: ProductFormProps) {
  const router = useRouter()
  const isEditMode = Boolean(product)

  const [isExtracting, startExtractTransition] = useTransition()
  const [isSaving, startSaveTransition] = useTransition()
  const [isUploadingImage, startUploadTransition] = useTransition()

  const [entryMode, setEntryMode] = useState<EntryMode>("url")
  const [step, setStep] = useState<FormStep>(isEditMode ? "preview" : "input")

  // Image state: extracted URL (create flow only) or uploaded storage path
  const [extractedImageUrl, setExtractedImageUrl] = useState<string | null>(null)
  const [uploadedStoragePath, setUploadedStoragePath] = useState<string | null>(null)
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null)
  const [imageRemoved, setImageRemoved] = useState(false)

  const [sourceUrl, setSourceUrl] = useState<string>(product?.source_url ?? "")
  const [internalOpen, setInternalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isControlled = open !== undefined
  const isOpen = isControlled ? open : internalOpen

  function handleOpenChange(val: boolean) {
    if (isControlled) onOpenChange?.(val)
    else setInternalOpen(val)
    if (!val) resetAll()
  }

  useEffect(() => {
    if (!isOpen || !isEditMode || !product) return

    setExtractedImageUrl(null)
    setUploadedStoragePath(null)
    setUploadedPreviewUrl(null)
    setImageRemoved(false)
    previewForm.reset({
      type: product.type,
      name: product.name,
      description: product.description ?? "",
      source_url: product.source_url ?? "",
    })
    // previewForm.reset is stable enough; product + initialImageUrl drive re-sync on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isEditMode, product?.id, initialImageUrl])

  const urlForm = useForm<ExtractProductValues>({
    resolver: zodResolver(extractProductSchema),
    defaultValues: { url: "", type: "product" },
  })

  const previewForm = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      type: product?.type ?? "product",
      name: product?.name ?? "",
      description: product?.description ?? "",
      source_url: product?.source_url ?? "",
    },
  })

  function resetAll() {
    setStep(isEditMode ? "preview" : "input")
    setEntryMode("url")
    setExtractedImageUrl(null)
    setUploadedStoragePath(null)
    setUploadedPreviewUrl(null)
    setImageRemoved(false)
    setSourceUrl(product?.source_url ?? "")
    urlForm.reset()
    previewForm.reset({
      type: product?.type ?? "product",
      name: product?.name ?? "",
      description: product?.description ?? "",
      source_url: product?.source_url ?? "",
    })
  }

  function handleExtract(values: ExtractProductValues) {
    startExtractTransition(async () => {
      const result = await extractFromUrl(values.url, values.type)

      if (!result.success) {
        toast.error(result.error)
        return
      }

      const extracted = result.data as ExtractResult
      setExtractedImageUrl(extracted.image_url)
      setSourceUrl(values.url)

      previewForm.reset({
        type: values.type,
        name: extracted.name,
        description: extracted.description,
        source_url: values.url,
      })

      setStep("preview")
    })
  }

  function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""

    startUploadTransition(async () => {
      const formData = new FormData()
      formData.set("file", file)
      if (uploadedStoragePath) {
        formData.set("replace_storage_path", uploadedStoragePath)
      }
      const result = await uploadProductImage(formData)

      if (!result.success) {
        toast.error(result.error)
        return
      }

      setUploadedStoragePath(result.data.storagePath)
      setUploadedPreviewUrl(result.data.previewUrl)
      setExtractedImageUrl(null)
      setImageRemoved(false)
    })
  }

  function removeUploadedImage() {
    setUploadedStoragePath(null)
    setUploadedPreviewUrl(null)
  }

  function removeImage() {
    if (uploadedStoragePath || uploadedPreviewUrl) {
      removeUploadedImage()
      return
    }
    setExtractedImageUrl(null)
    setImageRemoved(true)
  }

  function handleSave(values: ProductFormValues) {
    startSaveTransition(async () => {
      const result = isEditMode && product
        ? await updateProduct(product.id, {
            ...values,
            pre_uploaded_storage_path: uploadedStoragePath,
            remove_image: imageRemoved && !uploadedStoragePath,
          })
        : await createProduct({
            ...values,
            source_url: sourceUrl,
            image_url: extractedImageUrl,
            pre_uploaded_storage_path: uploadedStoragePath,
          })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success(`${PRODUCT_TYPE_LABELS[values.type]} saved successfully`)
      handleOpenChange(false)
      router.refresh()
    })
  }

  const previewImage =
    uploadedPreviewUrl ??
    (imageRemoved
      ? null
      : (extractedImageUrl ?? initialImageUrl ?? getFallbackImageUrl(product)))

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {trigger && (
        <span
          role="button"
          tabIndex={0}
          onClick={() => handleOpenChange(true)}
          onKeyDown={(e) => e.key === "Enter" && handleOpenChange(true)}
          className="contents"
        >
          {trigger}
        </span>
      )}

      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-[720px]">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {isEditMode ? "Edit Product or Service" : "Add Product or Service"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the name, description, type, or image for this entry."
              : "Extract details from a URL or fill them in manually."}
          </DialogDescription>
        </DialogHeader>

        {/* Mode tabs — only shown when adding, not editing */}
        {!isEditMode && step === "input" && (
          <div className="shrink-0 flex rounded-lg border bg-muted p-1 gap-1">
            <button
              type="button"
              onClick={() => setEntryMode("url")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                entryMode === "url"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Extract from URL
            </button>
            <button
              type="button"
              onClick={() => setEntryMode("manual")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                entryMode === "manual"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Add manually
            </button>
          </div>
        )}

        {/* URL extraction step */}
        {!isEditMode && step === "input" && entryMode === "url" && (
          <form onSubmit={urlForm.handleSubmit(handleExtract)} className="flex flex-col gap-4 overflow-hidden">
            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Controller
                  name="type"
                  control={urlForm.control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="product">Product</SelectItem>
                        <SelectItem value="service">Service</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="url">Website URL</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="url"
                    placeholder="https://example.com/product"
                    className="pl-9"
                    {...urlForm.register("url")}
                  />
                </div>
                {urlForm.formState.errors.url && (
                  <p className="text-xs text-destructive">{urlForm.formState.errors.url.message}</p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t pt-4">
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isExtracting}>
                {isExtracting ? (
                  <><Loader2 className="mr-2 size-4 animate-spin" />Fetching and analysing…</>
                ) : (
                  <><Sparkles className="mr-2 size-4" />Extract with AI</>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* Manual entry / preview / edit form */}
        {(isEditMode || step === "preview" || entryMode === "manual") && (
          <form onSubmit={previewForm.handleSubmit(handleSave)} className="flex flex-col gap-4 overflow-hidden">
            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              <div className="space-y-2">
                <Label htmlFor="preview-type">Type</Label>
                <Controller
                  name="type"
                  control={previewForm.control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="preview-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="product">Product</SelectItem>
                        <SelectItem value="service">Service</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Product or service name"
                  {...previewForm.register("name")}
                />
                {previewForm.formState.errors.name && (
                  <p className="text-xs text-destructive">{previewForm.formState.errors.name.message}</p>
                )}
              </div>

              <div className={previewImage ? "grid grid-cols-[1fr_220px] gap-4 items-start" : "space-y-2"}>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the product or service…"
                    className="h-44 resize-none overflow-y-auto"
                    {...previewForm.register("description")}
                  />
                  {previewForm.formState.errors.description && (
                    <p className="text-xs text-destructive">{previewForm.formState.errors.description.message}</p>
                  )}
                </div>

                {/* Image column */}
                <div className="space-y-2">
                  <Label className="text-sm">Image</Label>
                  {previewImage ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <ImagePreview key={previewImage} imageUrl={previewImage} />
                        <button
                          type="button"
                          onClick={removeImage}
                          className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow"
                          aria-label="Remove image"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingImage}
                        className="flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        {isUploadingImage ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <>
                            <Upload className="size-4" />
                            Replace
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="flex aspect-square w-full min-h-[220px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-muted text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                    >
                      {isUploadingImage ? (
                        <Loader2 className="size-6 animate-spin" />
                      ) : (
                        <>
                          <ImagePlus className="size-7" />
                          <span className="text-sm">Upload</span>
                        </>
                      )}
                    </button>
                  )}
                  {!previewImage && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      <Upload className="size-4" />
                      Browse
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageFileChange}
                  />
                </div>
              </div>
            </div>

            <div className="flex shrink-0 justify-between gap-2 border-t pt-4">
              {!isEditMode && step === "preview" && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep("input")}
                  disabled={isSaving}
                >
                  Back
                </Button>
              )}
              {(isEditMode || entryMode === "manual") && <span />}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving || isUploadingImage}>
                  {isSaving ? (
                    <><Loader2 className="mr-2 size-4 animate-spin" />Saving…</>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function getFallbackImageUrl(product: ProductRow | undefined): string | null {
  if (!product) return null
  const meta = product.metadata as Record<string, unknown> | null
  return typeof meta?.original_image_url === "string" ? meta.original_image_url : null
}

function ImagePreview({ imageUrl }: { imageUrl: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-lg border bg-muted text-muted-foreground">
        <ImageOff className="size-6" />
      </div>
    )
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-lg border bg-muted">
      <Image
        src={imageUrl}
        alt="Product image"
        fill
        className="object-cover"
        onError={() => setFailed(true)}
        unoptimized
      />
    </div>
  )
}

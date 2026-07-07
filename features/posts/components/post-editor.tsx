"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { formatScheduleDisplay } from "@/features/calendar/lib/datetime"
import {
  CalendarClock,
  ImageIcon,
  Loader2,
  Megaphone,
  Package,
  Rocket,
  Share2,
  Smile,
  Type,
  X,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  getActiveCampaign,
  markStrategyStepCompleted,
} from "@/features/marketing-strategy/actions"
import { createPost, publishNow, updatePost } from "@/features/posts/actions"
import { AiTextToolbar } from "@/features/posts/components/ai-text-toolbar"
import { ScheduleDateTimePicker } from "@/features/calendar/components/schedule-datetime-picker"
import { MediaSection } from "@/features/posts/components/media-section"
import {
  PostEditorSectionIcon,
  PostEditorSidebar,
} from "@/features/posts/components/post-editor-sidebar"
import { PostStatusBadge } from "@/features/posts/components/post-status-badge"
import {
  getPlatformBrandStyle,
  PlatformIconBadge,
} from "@/features/platforms/platform-icons"
import type { PostMediaWithUrl } from "@/features/posts/media-actions"
import type { ProductRow } from "@/features/products/actions"
import {
  canSchedulePost,
  COMMON_EMOJIS,
  formatPostStatus,
  previewSaveStatus,
  TIMEZONES,
} from "@/features/posts/lib/post-status"
import {
  postFormSchema,
  type PostFormValues,
} from "@/lib/validations/post"
import {
  DEFAULT_TIMEZONE,
} from "@/lib/validations/settings"
import {
  STRATEGY_CONTENT_TYPE_LABELS,
} from "@/lib/validations/marketing-campaign"
import { cn } from "@/lib/utils"
import type { ActiveCampaignContext } from "@/types/app"
import type { Enums, Tables } from "@/types/database"

const CONTENT_MAX_LENGTH = 5000
const USE_STRATEGY_STORAGE_KEY = "post-editor-use-marketing-strategy"

interface PostEditorProps {
  mode: "create" | "edit"
  postId?: string
  initialValues?: Partial<PostFormValues>
  platforms: Tables<"platforms">[]
  defaultTimezone?: string
  brandProfileComplete?: boolean
  initialMedia?: PostMediaWithUrl | null
  currentStatus?: Enums<"post_status">
  products?: ProductRow[]
  activeCampaign?: ActiveCampaignContext | null
}

export function PostEditor({
  mode,
  postId,
  initialValues,
  platforms,
  defaultTimezone = DEFAULT_TIMEZONE,
  brandProfileComplete = false,
  initialMedia = null,
  currentStatus,
  products = [],
  activeCampaign = null,
}: PostEditorProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [scheduleConfirmOpen, setScheduleConfirmOpen] = useState(false)
  const [pendingValues, setPendingValues] = useState<PostFormValues | null>(
    null,
  )
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [useMarketingStrategy, setUseMarketingStrategy] = useState(false)
  const [campaignContext, setCampaignContext] =
    useState<ActiveCampaignContext | null>(activeCampaign)

  useEffect(() => {
    const stored = localStorage.getItem(USE_STRATEGY_STORAGE_KEY)
    if (stored === "true") {
      setUseMarketingStrategy(true)
    }
  }, [])

  useEffect(() => {
    setCampaignContext(activeCampaign)
  }, [activeCampaign])

  const currentStep = campaignContext?.currentStep ?? null

  useEffect(() => {
    if (!useMarketingStrategy || !currentStep?.product_reference) {
      return
    }

    const match = products.find(
      (product) =>
        product.name.toLowerCase() ===
        currentStep.product_reference!.toLowerCase(),
    )

    if (match) {
      setSelectedProductId(match.id)
    }
  }, [useMarketingStrategy, currentStep, products])

  const selectedProduct = products.find((p) => p.id === selectedProductId) ?? null
  const productContextForAi = useMemo(() => {
    if (selectedProduct) {
      return {
        name: selectedProduct.name,
        description: selectedProduct.description,
      }
    }

    if (useMarketingStrategy && currentStep?.product_reference) {
      return {
        name: currentStep.product_reference,
        description: null,
      }
    }

    return null
  }, [selectedProduct, useMarketingStrategy, currentStep])
  const productContextForMedia = selectedProduct
    ? {
        name: selectedProduct.name,
        description: selectedProduct.description,
        imageStoragePath: selectedProduct.image_storage_path,
      }
    : null

  const defaultValues = useMemo<PostFormValues>(
    () => ({
      title: initialValues?.title ?? "",
      content: initialValues?.content ?? "",
      media_type: initialValues?.media_type ?? "none",
      scheduled_at: initialValues?.scheduled_at ?? null,
      timezone: initialValues?.timezone ?? defaultTimezone,
      platform_ids: initialValues?.platform_ids ?? [],
      brand_profile_id: initialValues?.brand_profile_id ?? null,
    }),
    [defaultTimezone, initialValues],
  )

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues,
  })

  const content = form.watch("content")
  const platformIds = form.watch("platform_ids")
  const mediaType = form.watch("media_type")
  const scheduledAt = form.watch("scheduled_at")

  const saveStatusPreview = canSchedulePost({
    content,
    platform_ids: platformIds,
    scheduled_at: scheduledAt,
  })
    ? "scheduled"
    : previewSaveStatus(scheduledAt, currentStatus)
  const isAppManagedStatus =
    currentStatus === "published" ||
    currentStatus === "publishing" ||
    currentStatus === "failed"

  const title = form.watch("title")
  const hasTitle = title.trim().length > 0
  const hasContent = content.trim().length > 0
  const hasSchedule = Boolean(
    scheduledAt && new Date(scheduledAt).getTime() > Date.now(),
  )
  const willScheduleOnCreate =
    mode === "create" &&
    canSchedulePost({
      content,
      platform_ids: platformIds,
      scheduled_at: scheduledAt,
    })
  const hasMedia = mediaType !== "none" || Boolean(initialMedia)
  const isEditMode = mode === "edit"
  const canPublishActions =
    isEditMode && currentStatus !== "publishing" && !isSubmitting

  const strategyStepForAi = useMemo(() => {
    if (!useMarketingStrategy || !campaignContext?.currentStep) {
      return null
    }

    const step = campaignContext.currentStep
    return {
      day: step.day,
      totalDays: campaignContext.totalSteps,
      content_type: step.content_type,
      topic: step.topic,
      objective: step.objective,
      notes: step.notes,
      product_reference: step.product_reference,
    }
  }, [useMarketingStrategy, campaignContext])

  function handleStrategyToggle(checked: boolean) {
    setUseMarketingStrategy(checked)
    localStorage.setItem(USE_STRATEGY_STORAGE_KEY, String(checked))
  }

  async function maybeCompleteStrategyStep() {
    if (!useMarketingStrategy || !campaignContext?.currentStep) {
      return
    }

    const result = await markStrategyStepCompleted(
      campaignContext.id,
      campaignContext.currentStep.day,
    )

    if (!result.success) {
      toast.error(result.error)
      return
    }

    const refreshed = await getActiveCampaign()
    if (refreshed.success) {
      setCampaignContext(refreshed.data)
    }
  }

  function togglePlatform(platformId: string, checked: boolean) {
    const current = form.getValues("platform_ids")
    if (checked) {
      form.setValue("platform_ids", [...new Set([...current, platformId])], {
        shouldValidate: true,
      })
      return
    }

    form.setValue(
      "platform_ids",
      current.filter((id) => id !== platformId),
      { shouldValidate: true },
    )
  }

  function insertEmoji(emoji: string) {
    const current = form.getValues("content")
    form.setValue("content", `${current}${emoji}`, { shouldValidate: true })
  }

  async function submitPost(values: PostFormValues) {
    setIsSubmitting(true)

    const result =
      mode === "create"
        ? await createPost(values)
        : await updatePost(postId!, values)

    setIsSubmitting(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    await maybeCompleteStrategyStep()

    const scheduledOnCreate =
      mode === "create" &&
      canSchedulePost({
        content: values.content,
        platform_ids: values.platform_ids,
        scheduled_at: values.scheduled_at,
      })

    toast.success(
      scheduledOnCreate
        ? "Post scheduled"
        : mode === "create"
          ? "Post created"
          : canSchedulePost(values)
            ? "Post scheduled"
            : "Post updated",
    )

    if (mode === "create") {
      router.push(scheduledOnCreate ? "/posts" : `/posts/${result.data.id}/edit`)
    } else {
      router.push("/posts")
    }

    router.refresh()
  }

  async function handleFormSubmit(values: PostFormValues) {
    if (isEditMode && canSchedulePost(values)) {
      setPendingValues(values)
      setScheduleConfirmOpen(true)
      return
    }

    await submitPost(values)
  }

  async function confirmScheduleSave() {
    if (!pendingValues) {
      return
    }

    const values = pendingValues
    setScheduleConfirmOpen(false)
    setPendingValues(null)
    await submitPost(values)
  }

  async function handlePublishNow() {
    if (mode !== "edit" || !postId) {
      return
    }

    const valid = await form.trigger()
    if (!valid) {
      return
    }

    setIsSubmitting(true)
    const result = await publishNow(postId, form.getValues())
    setIsSubmitting(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    await maybeCompleteStrategyStep()

    const { publish } = result.data
    if (publish.failed > 0) {
      toast.error("Publish completed with errors")
    } else {
      toast.success("Post published")
    }

    router.push("/posts")
    router.refresh()
  }

  return (
    <>
    <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
      {isEditMode && currentStatus ? (
        <Alert
          className={cn(
            "border",
            currentStatus === "failed" &&
              "border-red-500/30 bg-red-500/5",
            currentStatus === "published" &&
              "border-emerald-500/30 bg-emerald-500/5",
            currentStatus === "publishing" &&
              "border-amber-500/30 bg-amber-500/5",
            currentStatus === "scheduled" &&
              "border-sky-500/30 bg-sky-500/5",
          )}
        >
          <AlertTitle className="flex flex-wrap items-center gap-2">
            <span>You are editing this post</span>
            <PostStatusBadge status={currentStatus} />
          </AlertTitle>
          <AlertDescription>
            {currentStatus === "publishing"
              ? "Publication is running. Save and publish actions are temporarily disabled."
              : currentStatus === "published"
                ? "This post is live. Saving updates your draft record only — use Publish now to push changes to platforms."
                : currentStatus === "failed"
                  ? "The last publish attempt failed. Review your content and platforms, then try Publish now again."
                  : !isAppManagedStatus
                    ? `Saving will mark this post as ${formatPostStatus(saveStatusPreview).toLowerCase()}${saveStatusPreview === "scheduled" ? " based on your scheduled date" : " until you set a future schedule date"}.`
                    : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div
        className={cn(
          "grid gap-6",
          isEditMode ? "lg:grid-cols-[minmax(0,1fr)_280px]" : "",
        )}
      >
        <div className="min-w-0 space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <PostEditorSectionIcon
                    icon={Megaphone}
                    className="text-violet-600 dark:text-violet-400"
                  />
                  <div>
                    <CardTitle>Marketing strategy</CardTitle>
                    <CardDescription>
                      Use your active campaign to guide AI caption generation
                      step by step.
                    </CardDescription>
                  </div>
                </div>
                <Switch
                  checked={useMarketingStrategy}
                  onCheckedChange={handleStrategyToggle}
                  aria-label="Use marketing strategy"
                />
              </div>
            </CardHeader>
            {useMarketingStrategy ? (
              <CardContent className="space-y-3">
                {!campaignContext ? (
                  <Alert>
                    <AlertTitle>No active campaign</AlertTitle>
                    <AlertDescription>
                      Set a campaign as active on the{" "}
                      <Link
                        href="/marketing-strategy"
                        className="font-medium underline underline-offset-4"
                      >
                        Marketing Strategy
                      </Link>{" "}
                      page to use this feature.
                    </AlertDescription>
                  </Alert>
                ) : !currentStep ? (
                  <Alert>
                    <AlertTitle>Campaign complete</AlertTitle>
                    <AlertDescription>
                      All steps in &ldquo;{campaignContext.name}&rdquo; are
                      completed.{" "}
                      <Link
                        href={`/marketing-strategy/${campaignContext.id}`}
                        className="font-medium underline underline-offset-4"
                      >
                        View campaign
                      </Link>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{campaignContext.name}</span>
                      <span className="text-muted-foreground">
                        {campaignContext.completedCount} /{" "}
                        {campaignContext.totalSteps} completed
                      </span>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-2">
                      <p className="font-medium">
                        Day {currentStep.day}: {currentStep.topic}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Type: </span>
                        {STRATEGY_CONTENT_TYPE_LABELS[
                          currentStep.content_type as keyof typeof STRATEGY_CONTENT_TYPE_LABELS
                        ] ?? currentStep.content_type}
                      </p>
                      <p>
                        <span className="text-muted-foreground">
                          Objective:{" "}
                        </span>
                        {currentStep.objective}
                      </p>
                      {currentStep.notes ? (
                        <p>
                          <span className="text-muted-foreground">Notes: </span>
                          {currentStep.notes}
                        </p>
                      ) : null}
                      {currentStep.product_reference ? (
                        <p>
                          <span className="text-muted-foreground">
                            Product:{" "}
                          </span>
                          {currentStep.product_reference}
                        </p>
                      ) : null}
                    </div>
                    <Link
                      href={`/marketing-strategy/${campaignContext.id}`}
                      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      View full strategy
                    </Link>
                  </>
                )}
              </CardContent>
            ) : null}
          </Card>

          {products.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <PostEditorSectionIcon
                    icon={Package}
                    className="text-amber-600 dark:text-amber-400"
                  />
                  <div>
                    <CardTitle>Product context</CardTitle>
                    <CardDescription>
                      Optionally link a product or service. AI will incorporate
                      its description in captions and use its image as a
                      reference when generating visuals.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {selectedProduct ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium">
                        {selectedProduct.name}
                      </span>
                      <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs text-muted-foreground capitalize">
                        {selectedProduct.type}
                      </span>
                      {selectedProduct.image_storage_path && (
                        <span className="shrink-0 text-xs text-emerald-600 dark:text-emerald-400">
                          · image attached
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove product context"
                      onClick={() => setSelectedProductId(null)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <Select
                    value=""
                    onValueChange={(value) => {
                      if (value) {
                        setSelectedProductId(value)
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a product or service…" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          <span className="flex items-center gap-2">
                            <span>{product.name}</span>
                            <span className="text-xs text-muted-foreground capitalize">
                              ({product.type})
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-start gap-3">
                <PostEditorSectionIcon icon={Type} />
                <div>
                  <CardTitle>Content</CardTitle>
                  <CardDescription>
                    Internal title and the caption your audience will see.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Summer product launch announcement"
                  {...form.register("title")}
                />
                <p className="text-xs text-muted-foreground">
                  For your reference only — not sent to social platforms.
                </p>
                {form.formState.errors.title ? (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.title.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="content">Caption / post text</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {content.length}/{CONTENT_MAX_LENGTH}
                    </span>
                    <Popover>
                      <PopoverTrigger
                        render={
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label="Insert emoji"
                          />
                        }
                      >
                        <Smile className="size-4" />
                      </PopoverTrigger>
                      <PopoverContent className="w-64">
                        <div className="grid grid-cols-5 gap-1">
                          {COMMON_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className="rounded-md p-2 text-lg hover:bg-muted"
                              onClick={() => insertEmoji(emoji)}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <Textarea
                  id="content"
                  rows={8}
                  placeholder="Write your post caption here, or use AI tools below…"
                  {...form.register("content")}
                />
                {form.formState.errors.content ? (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.content.message}
                  </p>
                ) : null}

                <AiTextToolbar
                  content={content}
                  platformIds={platformIds}
                  postId={postId}
                  brandProfileComplete={brandProfileComplete}
                  onContentChange={(value) =>
                    form.setValue("content", value, { shouldValidate: true })
                  }
                  productContext={productContextForAi}
                  strategyStep={strategyStepForAi}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-start gap-3">
                <PostEditorSectionIcon
                  icon={ImageIcon}
                  className="text-violet-600 dark:text-violet-400"
                />
                <div>
                  <CardTitle>Media</CardTitle>
                  <CardDescription>
                    Optional image or video. AI images use your caption above.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <MediaSection
                postId={postId}
                postContent={content}
                brandProfileComplete={brandProfileComplete}
                initialMedia={initialMedia}
                mediaType={mediaType}
                onMediaTypeChange={(value) =>
                  form.setValue("media_type", value, { shouldValidate: true })
                }
                productContext={productContextForMedia}
              />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-start gap-3">
                <PostEditorSectionIcon
                  icon={Share2}
                  className="text-primary"
                />
                <div>
                  <CardTitle>Platforms</CardTitle>
                  <CardDescription>
                    Select where this post should be published.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {platforms.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No platforms available. Connect Facebook or Instagram in
                  Settings → Social Connections.
                </p>
              ) : (
                platforms.map((platform) => {
                  const selected = platformIds.includes(platform.id)
                  const brand = getPlatformBrandStyle(platform.icon_key)

                  return (
                    <label
                      key={platform.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all",
                        selected
                          ? cn("shadow-sm ring-1 ring-inset", brand.ring, brand.chipBg, brand.chipBorder)
                          : "hover:bg-muted/40",
                      )}
                    >
                      <Checkbox
                        checked={selected}
                        onCheckedChange={(checked) =>
                          togglePlatform(platform.id, checked === true)
                        }
                      />
                      <PlatformIconBadge
                        platformKey={platform.icon_key}
                        size="sm"
                      />
                      <span className="text-sm font-medium">
                        {platform.display_name}
                      </span>
                    </label>
                  )
                })
              )}
              {form.formState.errors.platform_ids ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.platform_ids.message}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-start gap-3">
                <PostEditorSectionIcon
                  icon={CalendarClock}
                  className="text-sky-600 dark:text-sky-400"
                />
                <div>
                  <CardTitle>Schedule</CardTitle>
                  <CardDescription>
                    Pick a future date and time in the timezone below. That
                    timezone controls when the post publishes.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                <strong className="font-medium text-foreground">Draft</strong>{" "}
                — no date or a past date.{" "}
                <strong className="font-medium text-foreground">Scheduled</strong>{" "}
                — future date and time set below.
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="scheduled_at">Date & time</Label>
                  <ScheduleDateTimePicker
                    id="scheduled_at"
                    value={scheduledAt}
                    timezone={form.watch("timezone")}
                    onChange={(value) =>
                      form.setValue("scheduled_at", value, {
                        shouldValidate: true,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select
                    value={form.watch("timezone")}
                    onValueChange={(value) => {
                      if (value) {
                        form.setValue("timezone", value, {
                          shouldValidate: true,
                        })
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((timezone) => (
                        <SelectItem key={timezone} value={timezone}>
                          {timezone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.timezone ? (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.timezone.message}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Example: 4:00 PM with Europe/London publishes at 4:00 PM
                      UK time (not your computer&apos;s local time).
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-dashed shadow-sm">
            <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1 text-sm">
                <p className="font-medium">Ready to finish?</p>
                <p className="text-muted-foreground">
                  {isEditMode
                    ? "Save your work or publish immediately. A future date and platform will schedule automatically."
                    : willScheduleOnCreate
                      ? "Post text, platform, and a future date are set — saving will schedule and return to Posts."
                      : "Add post text, pick a platform and future date to schedule, or save as draft to continue editing."}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
                {isEditMode ? (
                  <Button
                    type="button"
                    disabled={!canPublishActions}
                    onClick={() => void handlePublishNow()}
                  >
                    <Rocket className="size-4" />
                    Publish now
                  </Button>
                ) : null}
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {mode === "create"
                    ? willScheduleOnCreate
                      ? "Schedule post"
                      : "Save draft"
                    : "Save changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {isEditMode && currentStatus ? (
          <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
            <PostEditorSidebar
              currentStatus={currentStatus}
              saveStatusPreview={saveStatusPreview}
              hasTitle={hasTitle}
              hasContent={hasContent}
              platformCount={platformIds.length}
              hasMedia={hasMedia}
              hasSchedule={hasSchedule}
            />
          </aside>
        ) : null}
      </div>
    </form>

    <ConfirmDialog
      open={scheduleConfirmOpen}
      onOpenChange={(open) => {
        setScheduleConfirmOpen(open)
        if (!open) {
          setPendingValues(null)
        }
      }}
      title="Schedule this post?"
      description={
        pendingValues?.scheduled_at
          ? `This post will be scheduled for ${formatScheduleDisplay(
              pendingValues.scheduled_at,
              pendingValues.timezone,
            )} (${pendingValues.timezone}) and publish automatically to your selected platforms.`
          : "This post will be scheduled and publish automatically at the selected time."
      }
      confirmLabel="Schedule post"
      loading={isSubmitting}
      onConfirm={confirmScheduleSave}
    />
    </>
  )
}

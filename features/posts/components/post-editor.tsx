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
  PostEditorSectionHeader,
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

const AI_CONTEXT_THEMES = {
  strategy: {
    card: {
      background: "color-mix(in srgb, #8b5cf6 10%, var(--color-card))",
      boxShadow:
        "inset 2px 0 0 #8b5cf6, 0 0 0 1px color-mix(in srgb, #8b5cf6 24%, transparent)",
    },
    icon: {
      background: "color-mix(in srgb, #8b5cf6 16%, transparent)",
      borderColor: "color-mix(in srgb, #8b5cf6 35%, transparent)",
      color: "#7c3aed",
    },
    badge: {
      color: "#7c3aed",
      background: "color-mix(in srgb, #8b5cf6 14%, transparent)",
      borderColor: "color-mix(in srgb, #8b5cf6 28%, transparent)",
    },
  },
  product: {
    card: {
      background: "color-mix(in srgb, #f59e0b 10%, var(--color-card))",
      boxShadow:
        "inset 2px 0 0 #f59e0b, 0 0 0 1px color-mix(in srgb, #f59e0b 24%, transparent)",
    },
    icon: {
      background: "color-mix(in srgb, #f59e0b 16%, transparent)",
      borderColor: "color-mix(in srgb, #f59e0b 35%, transparent)",
      color: "#d97706",
    },
    badge: {
      color: "#d97706",
      background: "color-mix(in srgb, #f59e0b 14%, transparent)",
      borderColor: "color-mix(in srgb, #f59e0b 28%, transparent)",
    },
  },
} as const

const AI_CONTEXT_CARD_CLASS =
  "shadow-none ring-0 [--card-spacing:--spacing(2.5)] data-[size=sm]:[--card-spacing:--spacing(2.5)]"
const AI_CONTEXT_ICON_CLASS = "size-6 rounded-md [&>svg]:size-3"
const AI_CONTEXT_HEADER_CLASS = "gap-0 pb-0"
const AI_CONTEXT_TITLE_CLASS = "text-sm leading-snug"
const AI_CONTEXT_DESC_CLASS = "text-xs leading-snug"

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
          <div className="space-y-3">
          <Card
            size="sm"
            className={AI_CONTEXT_CARD_CLASS}
            style={AI_CONTEXT_THEMES.strategy.card}
          >
            <CardHeader className={AI_CONTEXT_HEADER_CLASS}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <PostEditorSectionIcon
                    icon={Megaphone}
                    className={AI_CONTEXT_ICON_CLASS}
                    style={AI_CONTEXT_THEMES.strategy.icon}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <CardTitle className={AI_CONTEXT_TITLE_CLASS}>
                        Marketing strategy
                      </CardTitle>
                      <span
                        className="inline-flex rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide"
                        style={AI_CONTEXT_THEMES.strategy.badge}
                      >
                        AI context
                      </span>
                    </div>
                    <CardDescription className={AI_CONTEXT_DESC_CLASS}>
                      Guides AI captions from your active campaign.
                    </CardDescription>
                  </div>
                </div>
                <Switch
                  checked={useMarketingStrategy}
                  onCheckedChange={handleStrategyToggle}
                  aria-label="Use marketing strategy"
                  className="shrink-0 scale-90"
                />
              </div>
            </CardHeader>
            {useMarketingStrategy ? (
              <CardContent className="space-y-2 pt-2">
                {!campaignContext ? (
                  <Alert className="py-2">
                    <AlertTitle className="text-sm">No active campaign</AlertTitle>
                    <AlertDescription className="text-xs">
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
                  <Alert className="py-2">
                    <AlertTitle className="text-sm">Campaign complete</AlertTitle>
                    <AlertDescription className="text-xs">
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
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-medium">{campaignContext.name}</span>
                      <span className="text-muted-foreground">
                        {campaignContext.completedCount} /{" "}
                        {campaignContext.totalSteps} completed
                      </span>
                    </div>
                    <div className="space-y-1 border-t border-foreground/10 pt-2">
                      <p className="text-xs font-medium text-foreground/80">
                        Day {currentStep.day}: {currentStep.topic}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        <span className="font-medium">Type: </span>
                        {STRATEGY_CONTENT_TYPE_LABELS[
                          currentStep.content_type as keyof typeof STRATEGY_CONTENT_TYPE_LABELS
                        ] ?? currentStep.content_type}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        <span className="font-medium">Objective: </span>
                        {currentStep.objective}
                      </p>
                      {currentStep.notes ? (
                        <p className="text-[11px] text-muted-foreground">
                          <span className="font-medium">Notes: </span>
                          {currentStep.notes}
                        </p>
                      ) : null}
                      {currentStep.product_reference ? (
                        <p className="text-[11px] text-muted-foreground">
                          <span className="font-medium">Product: </span>
                          {currentStep.product_reference}
                        </p>
                      ) : null}
                    </div>
                    <Link
                      href={`/marketing-strategy/${campaignContext.id}`}
                      className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                    >
                      View full strategy
                    </Link>
                  </>
                )}
              </CardContent>
            ) : null}
          </Card>

          {products.length > 0 && (
            <Card
              size="sm"
              className={AI_CONTEXT_CARD_CLASS}
              style={AI_CONTEXT_THEMES.product.card}
            >
              <CardHeader className={AI_CONTEXT_HEADER_CLASS}>
                <div className="flex min-w-0 items-center gap-2">
                  <PostEditorSectionIcon
                    icon={Package}
                    className={AI_CONTEXT_ICON_CLASS}
                    style={AI_CONTEXT_THEMES.product.icon}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <CardTitle className={AI_CONTEXT_TITLE_CLASS}>
                        Product context
                      </CardTitle>
                      <span
                        className="inline-flex rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide"
                        style={AI_CONTEXT_THEMES.product.badge}
                      >
                        AI context
                      </span>
                    </div>
                    <CardDescription className={AI_CONTEXT_DESC_CLASS}>
                      Link a product for AI captions and visual reference.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="product-context" className="text-xs">
                    Product or service
                  </Label>
                  <Select
                    value={selectedProductId ?? "none"}
                    onValueChange={(value) => {
                      setSelectedProductId(value === "none" ? null : value)
                    }}
                  >
                    <SelectTrigger
                      id="product-context"
                      className="h-9 w-full text-sm"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2 truncate text-left">
                        {selectedProduct ? (
                          <>
                            <Package className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                            <span className="truncate">{selectedProduct.name}</span>
                            <span className="shrink-0 text-xs text-muted-foreground capitalize">
                              ({selectedProduct.type})
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">
                            Select a product or service…
                          </span>
                        )}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No product or service</SelectItem>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} ({product.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedProduct ? (
                  <div className="space-y-1 text-[11px] text-muted-foreground">
                    {selectedProduct.description ? (
                      <p className="line-clamp-2">{selectedProduct.description}</p>
                    ) : (
                      <p>No description — add one in Products for richer AI captions.</p>
                    )}
                    {selectedProduct.image_storage_path ? (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                        Reference image available for AI visuals
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}
          </div>

          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <PostEditorSectionHeader
                icon={Type}
                title="Content"
                description="Write your post title and caption."
              />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  className="h-9"
                  placeholder="e.g. Summer product launch announcement"
                  {...form.register("title")}
                />
                {form.formState.errors.title ? (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.title.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-3 border-t border-foreground/10 pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Label htmlFor="content" className="text-sm font-semibold">
                      Post text
                    </Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      The message your audience will see when this post is
                      published.
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        content.length > CONTENT_MAX_LENGTH * 0.9
                          ? "font-medium text-amber-700 dark:text-amber-400"
                          : "text-muted-foreground",
                      )}
                    >
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
                  className="min-h-[180px] resize-y text-sm leading-relaxed"
                  placeholder="Write your post caption here…"
                  {...form.register("content")}
                />
                {form.formState.errors.content ? (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.content.message}
                  </p>
                ) : null}

                <div className="border-t border-foreground/10 pt-4">
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
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <PostEditorSectionHeader
                icon={ImageIcon}
                title="Media"
                description="Optional image or video. AI images use your post text above."
                iconClassName="text-violet-600 dark:text-violet-400"
              />
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
            <CardHeader className="pb-4">
              <PostEditorSectionHeader
                icon={Share2}
                title="Platforms"
                description="Select where this post should be published."
                iconClassName="text-primary"
              />
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
            <CardHeader className="pb-4">
              <PostEditorSectionHeader
                icon={CalendarClock}
                title="Schedule"
                description="Pick a future date and time in the timezone below."
                iconClassName="text-sky-600 dark:text-sky-400"
              />
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

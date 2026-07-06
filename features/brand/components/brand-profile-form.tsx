"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Globe, Loader2, Sparkles, X } from "lucide-react"
import { useState, useTransition } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { upsertBrandProfile, extractBrandFromUrl } from "@/features/brand/actions"
import {
  BRAND_VALUES_OPTIONS,
  BRAND_VOICE_OPTIONS,
  CTA_OPTIONS,
  WRITING_STYLE_OPTIONS,
} from "@/features/brand/constants"
import { computeBrandProfileComplete } from "@/features/brand/guards"
import { getBrandProfileDefaultValues } from "@/features/brand/lib/mappers"
import {
  brandProfileFormSchema,
  extractBrandFromUrlSchema,
  type BrandProfileFormValues,
  type ExtractBrandFromUrlValues,
} from "@/lib/validations/brand-profile"
import type { BrandProfileRow } from "@/types/app"
import { cn } from "@/lib/utils"

interface BrandProfileFormProps {
  userId: string
  initialProfile: BrandProfileRow | null
}

type EntryMode = "url" | "manual"

function hasExistingBrandData(profile: BrandProfileRow | null): boolean {
  return Boolean(profile?.brand_name?.trim())
}

interface MultiSelectChipsProps<T extends string> {
  options: readonly T[]
  value: T[]
  onChange: (value: T[]) => void
  disabled?: boolean
}

function MultiSelectChips<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: MultiSelectChipsProps<T>) {
  const toggle = (option: T) => {
    if (disabled) {
      return
    }

    if (value.includes(option)) {
      onChange(value.filter((item) => item !== option))
      return
    }

    onChange([...value, option])
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = value.includes(option)

        return (
          <Badge
            key={option}
            variant={selected ? "default" : "outline"}
            className={cn(
              "cursor-pointer select-none",
              disabled && "pointer-events-none opacity-50",
            )}
            onClick={() => toggle(option)}
          >
            {option}
          </Badge>
        )
      })}
    </div>
  )
}

interface TagInputProps {
  label: string
  description?: string
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  disabled?: boolean
}

function TagInput({
  label,
  description,
  value,
  onChange,
  placeholder,
  disabled,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("")

  const addTag = () => {
    const trimmed = inputValue.trim()
    if (!trimmed || value.includes(trimmed)) {
      setInputValue("")
      return
    }

    onChange([...value, trimmed])
    setInputValue("")
  }

  const removeTag = (tag: string) => {
    onChange(value.filter((item) => item !== tag))
  }

  return (
    <div className="space-y-2">
      <div>
        <Label>{label}</Label>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              addTag()
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={addTag}
          disabled={disabled}
        >
          Add
        </Button>
      </div>

      {value.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <button
                type="button"
                className="rounded-sm hover:text-destructive"
                onClick={() => removeTag(tag)}
                disabled={disabled}
                aria-label={`Remove ${tag}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )
}

interface ColorFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
}

function ColorField({
  label,
  value,
  onChange,
  error,
  disabled,
}: ColorFieldProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="size-10 cursor-pointer rounded-md border border-input bg-transparent p-1"
        />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          className="font-mono uppercase"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

export function BrandProfileForm({
  userId,
  initialProfile,
}: BrandProfileFormProps) {
  const hasExistingProfile = hasExistingBrandData(initialProfile)
  const [entryMode, setEntryMode] = useState<EntryMode>(
    hasExistingProfile ? "manual" : "url",
  )
  const [showForm, setShowForm] = useState(hasExistingProfile)
  const [profileId, setProfileId] = useState<string | undefined>(
    initialProfile?.id,
  )
  const [isPending, startTransition] = useTransition()
  const [isExtracting, startExtractTransition] = useTransition()

  const defaultValues = getBrandProfileDefaultValues(userId, initialProfile)

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<BrandProfileFormValues>({
    resolver: zodResolver(brandProfileFormSchema),
    defaultValues,
  })

  const urlForm = useForm<ExtractBrandFromUrlValues>({
    resolver: zodResolver(extractBrandFromUrlSchema),
    defaultValues: { url: "" },
  })

  const watchedValues = watch()
  const isComplete = computeBrandProfileComplete(watchedValues)

  function handleExtract(values: ExtractBrandFromUrlValues) {
    startExtractTransition(async () => {
      const result = await extractBrandFromUrl(values.url)

      if (!result.success) {
        toast.error(result.error)
        return
      }

      reset({
        ...defaultValues,
        ...result.data,
      })
      setShowForm(true)
      toast.success("Brand profile imported. Review the fields and save.")
    })
  }

  const onSubmit = handleSubmit(
    (values) => {
      startTransition(async () => {
        const result = await upsertBrandProfile({
          ...values,
          id: profileId,
        })

        if (!result.success) {
          toast.error(result.error)
          return
        }

        setProfileId(result.data.id)
        toast.success(
          result.data.is_complete
            ? "Brand profile saved and complete."
            : "Brand profile saved. Complete all fields for the best AI results.",
        )
      })
    },
    () => {
      toast.error("Please complete the highlighted fields before saving.")
    },
  )

  return (
    <div className="space-y-6">
      <div className="flex rounded-lg border bg-muted p-1 gap-1">
        <button
          type="button"
          onClick={() => setEntryMode("url")}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            entryMode === "url"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Import from website
        </button>
        <button
          type="button"
          onClick={() => {
            setEntryMode("manual")
            setShowForm(true)
          }}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            entryMode === "manual"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Fill manually
        </button>
      </div>

      {entryMode === "url" ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {showForm ? "Re-import from website" : "Import from website"}
            </CardTitle>
            <CardDescription>
              Paste your business website URL. AI will read the page and fill
              in your brand profile fields for you to review.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={urlForm.handleSubmit(handleExtract)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="brand-url">Website URL</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="brand-url"
                    placeholder="https://yourbusiness.com"
                    className="pl-9"
                    disabled={isExtracting}
                    {...urlForm.register("url")}
                  />
                </div>
                {urlForm.formState.errors.url ? (
                  <p className="text-sm text-destructive">
                    {urlForm.formState.errors.url.message}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={isExtracting}>
                  {isExtracting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Fetching and analysing…
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 size-4" />
                      {showForm ? "Re-import with AI" : "Extract with AI"}
                    </>
                  )}
                </Button>
                {!showForm ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isExtracting}
                    onClick={() => {
                      setEntryMode("manual")
                      setShowForm(true)
                    }}
                  >
                    Fill manually instead
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {showForm || entryMode === "manual" ? (
        <form onSubmit={onSubmit} className="space-y-6">
          {entryMode === "url" && showForm ? (
            <Alert>
              <AlertDescription>
                Imported from website. Review every field before saving — you
                can still edit anything manually.
              </AlertDescription>
            </Alert>
          ) : null}
          {!isComplete ? (
        <Alert>
          <AlertDescription>
            Complete all required fields to enable AI features. AI generation
            stays disabled until your profile is complete.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <AlertDescription>
            Your brand profile is complete. AI features can use this context.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Company</CardTitle>
          <CardDescription>
            Core business details used in every AI prompt.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="brand_name">Brand Name</Label>
            <Input
              id="brand_name"
              disabled={isPending}
              aria-invalid={Boolean(errors.brand_name)}
              {...register("brand_name")}
            />
            {errors.brand_name ? (
              <p className="text-sm text-destructive">
                {errors.brand_name.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="business_description">Business Description</Label>
            <Textarea
              id="business_description"
              rows={4}
              disabled={isPending}
              aria-invalid={Boolean(errors.business_description)}
              {...register("business_description")}
            />
            {errors.business_description ? (
              <p className="text-sm text-destructive">
                {errors.business_description.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              disabled={isPending}
              aria-invalid={Boolean(errors.industry)}
              {...register("industry")}
            />
            {errors.industry ? (
              <p className="text-sm text-destructive">
                {errors.industry.message}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audience & Voice</CardTitle>
          <CardDescription>
            Define who you speak to and how your brand sounds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="target_audience">Target Audience</Label>
            <Textarea
              id="target_audience"
              rows={3}
              disabled={isPending}
              aria-invalid={Boolean(errors.target_audience)}
              {...register("target_audience")}
            />
            {errors.target_audience ? (
              <p className="text-sm text-destructive">
                {errors.target_audience.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Brand Voice</Label>
            <Controller
              control={control}
              name="brand_voice"
              render={({ field }) => (
                <MultiSelectChips
                  options={BRAND_VOICE_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={isPending}
                />
              )}
            />
            {errors.brand_voice ? (
              <p className="text-sm text-destructive">
                {errors.brand_voice.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Writing Style</Label>
            <Controller
              control={control}
              name="writing_style"
              render={({ field }) => (
                <MultiSelectChips
                  options={WRITING_STYLE_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={isPending}
                />
              )}
            />
            {errors.writing_style ? (
              <p className="text-sm text-destructive">
                {errors.writing_style.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Brand Values</Label>
            <Controller
              control={control}
              name="brand_values"
              render={({ field }) => (
                <MultiSelectChips
                  options={BRAND_VALUES_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={isPending}
                />
              )}
            />
            {errors.brand_values ? (
              <p className="text-sm text-destructive">
                {errors.brand_values.message}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Content Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Preferred Call-to-Actions</Label>
            <Controller
              control={control}
              name="preferred_ctas"
              render={({ field }) => (
                <MultiSelectChips
                  options={CTA_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={isPending}
                />
              )}
            />
            {errors.preferred_ctas ? (
              <p className="text-sm text-destructive">
                {errors.preferred_ctas.message}
              </p>
            ) : null}
          </div>

          <Controller
            control={control}
            name="keywords"
            render={({ field }) => (
              <TagInput
                label="Keywords"
                description="SEO keywords the AI should weave into content when relevant."
                value={field.value}
                onChange={field.onChange}
                placeholder="Add a keyword"
                disabled={isPending}
              />
            )}
          />

          <Controller
            control={control}
            name="avoid_words"
            render={({ field }) => (
              <TagInput
                label="Avoid Words"
                description="Words the AI should never use."
                value={field.value}
                onChange={field.onChange}
                placeholder="Add a word to avoid"
                disabled={isPending}
              />
            )}
          />

          <Controller
            control={control}
            name="competitors"
            render={({ field }) => (
              <TagInput
                label="Competitors"
                description="Optional competitor names for positioning context."
                value={field.value}
                onChange={field.onChange}
                placeholder="Add a competitor"
                disabled={isPending}
              />
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Brand Colors</CardTitle>
          <CardDescription>
            Colors guide AI image generation and visual consistency.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Controller
            control={control}
            name="color_primary"
            render={({ field }) => (
              <ColorField
                label="Primary"
                value={field.value}
                onChange={field.onChange}
                error={errors.color_primary?.message}
                disabled={isPending}
              />
            )}
          />
          <Controller
            control={control}
            name="color_secondary"
            render={({ field }) => (
              <ColorField
                label="Secondary"
                value={field.value}
                onChange={field.onChange}
                error={errors.color_secondary?.message}
                disabled={isPending}
              />
            )}
          />
          <Controller
            control={control}
            name="color_accent"
            render={({ field }) => (
              <ColorField
                label="Accent"
                value={field.value}
                onChange={field.onChange}
                error={errors.color_accent?.message}
                disabled={isPending}
              />
            )}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save brand profile"}
        </Button>
      </div>
        </form>
      ) : null}
    </div>
  )
}

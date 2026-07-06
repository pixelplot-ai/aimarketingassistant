"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTransition } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateAppSettings } from "@/features/settings/actions"
import {
  getPlatformBrandStyle,
  PlatformIconBadge,
} from "@/features/platforms/platform-icons"
import {
  appSettingsSchema,
  DATE_FORMAT_OPTIONS,
  TIMEZONE_OPTIONS,
  type AppSettingsFormValues,
} from "@/lib/validations/settings"
import type { PlatformRow } from "@/types/app"
import { cn } from "@/lib/utils"

interface AppSettingsFormProps {
  defaultValues: AppSettingsFormValues
  platforms: PlatformRow[]
}

const POST_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
] as const

export function AppSettingsForm({
  defaultValues,
  platforms,
}: AppSettingsFormProps) {
  const [isPending, startTransition] = useTransition()

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AppSettingsFormValues>({
    resolver: zodResolver(appSettingsSchema),
    defaultValues,
  })

  const selectedPlatforms = watch("default_platform_ids")

  const togglePlatform = (platformId: string) => {
    if (selectedPlatforms.includes(platformId)) {
      setValue(
        "default_platform_ids",
        selectedPlatforms.filter((id) => id !== platformId),
        { shouldValidate: true },
      )
      return
    }

    setValue("default_platform_ids", [...selectedPlatforms, platformId], {
      shouldValidate: true,
    })
  }

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await updateAppSettings(values)

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success("Application settings saved.")
    })
  })

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Regional</CardTitle>
          <CardDescription>
            Defaults for dates, times, and new posts.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Controller
              control={control}
              name="timezone"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    if (value) {
                      field.onChange(value)
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONE_OPTIONS.map((timezone) => (
                      <SelectItem key={timezone} value={timezone}>
                        {timezone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.timezone ? (
              <p className="text-sm text-destructive">
                {errors.timezone.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Date Format</Label>
            <Controller
              control={control}
              name="date_format"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    if (value) {
                      field.onChange(value)
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FORMAT_OPTIONS.map((format) => (
                      <SelectItem key={format} value={format}>
                        {format}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Default Post Status</Label>
            <Controller
              control={control}
              name="default_post_status"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    if (value) {
                      field.onChange(value)
                    }
                  }}
                >
                  <SelectTrigger className="w-full md:w-80">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {POST_STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default Social Platforms</CardTitle>
          <CardDescription>
            Pre-select platforms when creating new posts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {platforms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No enabled platforms available.
            </p>
          ) : (
            platforms.map((platform) => {
              const checked = selectedPlatforms.includes(platform.id)
              const brand = getPlatformBrandStyle(platform.icon_key)

              return (
                <label
                  key={platform.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                    checked && cn(brand.chipBg, brand.chipBorder, "ring-1 ring-inset", brand.ring),
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => togglePlatform(platform.id)}
                    disabled={isPending}
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
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save application settings"}
        </Button>
      </div>
    </form>
  )
}

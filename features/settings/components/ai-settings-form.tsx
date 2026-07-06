"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useTransition } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { updateAiSettings } from "@/features/settings/actions"
import {
  aiSettingsSchema,
  DEFAULT_IMAGE_PROMPT,
  DEFAULT_TEXT_LENGTH_PROMPT,
  DEFAULT_TEXT_PROMPT,
  GEMINI_IMAGE_SIZE_OPTIONS,
  GEMINI_IMAGE_STYLE_OPTIONS,
  GEMINI_MODEL_OPTIONS,
  OPENAI_MODEL_OPTIONS,
  TEXT_AI_PROVIDER_OPTIONS,
  type AiSettingsFormValues,
} from "@/lib/validations/settings"
import { cn } from "@/lib/utils"

interface AiSettingsFormProps {
  defaultValues: AiSettingsFormValues
  openAiAvailable: boolean
}

export function AiSettingsForm({
  defaultValues,
  openAiAvailable,
}: AiSettingsFormProps) {
  const [isPending, startTransition] = useTransition()

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AiSettingsFormValues>({
    resolver: zodResolver(aiSettingsSchema),
    defaultValues,
  })

  const textProvider = watch("text_ai_provider")

  useEffect(() => {
    if (!openAiAvailable && textProvider === "openai") {
      setValue("text_ai_provider", "gemini")
    }
  }, [openAiAvailable, textProvider, setValue])

  const onSubmit = handleSubmit(
    (values) => {
      startTransition(async () => {
        const payload = {
          ...values,
          text_ai_provider: openAiAvailable
            ? values.text_ai_provider
            : ("gemini" as const),
        }
        const result = await updateAiSettings(payload)

        if (!result.success) {
          toast.error(result.error)
          return
        }

        toast.success("AI settings saved.")
      })
    },
    () => {
      toast.error("Please fix the highlighted AI settings fields.")
    },
  )

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {!openAiAvailable ? (
        <Alert>
          <AlertDescription>
            OpenAI is not configured on the server. Add{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              OPENAI_API_KEY
            </code>{" "}
            to your environment to enable it. Text generation uses Gemini.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Text Generation</CardTitle>
          <CardDescription>
            Choose the provider and shared parameters for post captions and
            copywriting. API keys stay on the server.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="text_ai_provider">Provider</Label>
            <Controller
              control={control}
              name="text_ai_provider"
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
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEXT_AI_PROVIDER_OPTIONS.map((provider) => (
                      <SelectItem
                        key={provider}
                        value={provider}
                        disabled={provider === "openai" && !openAiAvailable}
                      >
                        {provider === "openai" ? "OpenAI" : "Gemini"}
                        {provider === "openai" && !openAiAvailable
                          ? " (not configured)"
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.text_ai_provider ? (
              <p className="text-sm text-destructive">
                {errors.text_ai_provider.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="openai_temperature">Temperature</Label>
            <Input
              id="openai_temperature"
              type="number"
              step="0.1"
              min="0"
              max="2"
              disabled={isPending}
              {...register("openai_temperature", { valueAsNumber: true })}
            />
            {errors.openai_temperature ? (
              <p className="text-sm text-destructive">
                {errors.openai_temperature.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="openai_max_tokens">Max Tokens</Label>
            <Input
              id="openai_max_tokens"
              type="number"
              step="1"
              min="256"
              max="4096"
              disabled={isPending}
              {...register("openai_max_tokens", { valueAsNumber: true })}
            />
            {errors.openai_max_tokens ? (
              <p className="text-sm text-destructive">
                {errors.openai_max_tokens.message}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card
        className={cn(!openAiAvailable && "opacity-50")}
      >
        <CardHeader>
          <CardTitle>OpenAI</CardTitle>
          <CardDescription>
            {!openAiAvailable
              ? "Not available — OPENAI_API_KEY is not configured on the server."
              : textProvider === "openai"
                ? "Active text provider — model used for caption and copywriting."
                : "Model used when OpenAI is selected as the text provider."}
          </CardDescription>
        </CardHeader>
        <CardContent
          className={cn(
            "grid gap-4 md:grid-cols-2",
            !openAiAvailable && "pointer-events-none",
          )}
        >
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="openai_model">Model</Label>
            <Controller
              control={control}
              name="openai_model"
              render={({ field }) => (
                <Select
                  value={field.value}
                  disabled={!openAiAvailable || isPending}
                  onValueChange={(value) => {
                    if (value) {
                      field.onChange(value)
                    }
                  }}
                >
                  <SelectTrigger className="w-full md:w-80">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPENAI_MODEL_OPTIONS.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.openai_model ? (
              <p className="text-sm text-destructive">
                {errors.openai_model.message}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gemini</CardTitle>
          <CardDescription>
            {textProvider === "gemini"
              ? "Active text provider — model below is used for captions and copywriting."
              : "Text model when Gemini is selected, plus image generation settings."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="gemini_model">Text Model</Label>
            <Controller
              control={control}
              name="gemini_model"
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
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {GEMINI_MODEL_OPTIONS.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>Image Size</Label>
            <Controller
              control={control}
              name="gemini_image_size"
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
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    {GEMINI_IMAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>Image Style</Label>
            <Controller
              control={control}
              name="gemini_image_style"
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
                    <SelectValue placeholder="Select style" />
                  </SelectTrigger>
                  <SelectContent>
                    {GEMINI_IMAGE_STYLE_OPTIONS.map((style) => (
                      <SelectItem key={style} value={style}>
                        {style}
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
          <CardTitle>Default Prompts</CardTitle>
          <CardDescription>
            System instructions applied to every text and image generation.
            Leave empty to use the built-in defaults shown as placeholders.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="default_text_prompt">Text generation prompt</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => setValue("default_text_prompt", DEFAULT_TEXT_PROMPT)}
              >
                Use built-in default
              </Button>
            </div>
            <Textarea
              id="default_text_prompt"
              rows={5}
              disabled={isPending}
              placeholder={DEFAULT_TEXT_PROMPT}
              {...register("default_text_prompt")}
            />
            {errors.default_text_prompt ? (
              <p className="text-sm text-destructive">
                {errors.default_text_prompt.message}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Used as the system instruction for Generate, Rewrite, Hashtags,
                and all other text AI actions.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="default_text_length_prompt">
                Text length prompt
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  setValue(
                    "default_text_length_prompt",
                    DEFAULT_TEXT_LENGTH_PROMPT,
                  )
                }
              >
                Use built-in default
              </Button>
            </div>
            <Textarea
              id="default_text_length_prompt"
              rows={3}
              disabled={isPending}
              placeholder={DEFAULT_TEXT_LENGTH_PROMPT}
              {...register("default_text_length_prompt")}
            />
            {errors.default_text_length_prompt ? (
              <p className="text-sm text-destructive">
                {errors.default_text_length_prompt.message}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Length guidance appended to every text AI action (Generate,
                Rewrite, Hashtags, etc.).
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="default_image_prompt">Image generation prompt</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  setValue("default_image_prompt", DEFAULT_IMAGE_PROMPT)
                }
              >
                Use built-in default
              </Button>
            </div>
            <Textarea
              id="default_image_prompt"
              rows={5}
              disabled={isPending}
              placeholder={DEFAULT_IMAGE_PROMPT}
              {...register("default_image_prompt")}
            />
            {errors.default_image_prompt ? (
              <p className="text-sm text-destructive">
                {errors.default_image_prompt.message}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Combined with the post caption, optional extra direction, and
                brand profile when generating post images.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save AI settings"}
        </Button>
      </div>
    </form>
  )
}

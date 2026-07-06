"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  createCampaign,
  updateCampaign,
} from "@/features/marketing-strategy/actions"
import { ProductMultiSelect } from "@/features/marketing-strategy/components/product-multi-select"
import type { ProductRow } from "@/features/products/actions"
import {
  campaignFormSchema,
  type CampaignFormValues,
} from "@/lib/validations/marketing-campaign"
import type { MarketingCampaignWithProgress } from "@/types/app"

interface CampaignFormProps {
  products: ProductRow[]
  campaign?: MarketingCampaignWithProgress
  hasStrategy?: boolean
}

export function CampaignForm({
  products,
  campaign,
  hasStrategy = false,
}: CampaignFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEdit = Boolean(campaign)

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: campaign?.name ?? "",
      duration_days: campaign?.duration_days ?? 7,
      campaign_goal: campaign?.campaign_goal ?? "",
      target_audience: campaign?.target_audience ?? "",
      seasonality: campaign?.seasonality ?? "",
      extra_instructions: campaign?.extra_instructions ?? "",
      product_ids: campaign?.product_ids ?? [],
    },
  })

  function onSubmit(values: CampaignFormValues) {
    startTransition(async () => {
      const result = isEdit
        ? await updateCampaign(campaign!.id, values)
        : await createCampaign(values)

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success(isEdit ? "Campaign updated" : "Campaign created")

      if (isEdit) {
        router.refresh()
      } else if (result.data) {
        router.push(`/marketing-strategy/${result.data.id}`)
      }
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Campaign name</Label>
          <Input id="name" {...form.register("name")} />
          {form.formState.errors.name ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.name.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="duration_days">Duration (days)</Label>
          <Input
            id="duration_days"
            type="number"
            min={1}
            max={30}
            disabled={hasStrategy}
            {...form.register("duration_days", { valueAsNumber: true })}
          />
          {hasStrategy ? (
            <p className="text-xs text-muted-foreground">
              Duration cannot be changed after generating a strategy.
            </p>
          ) : null}
          {form.formState.errors.duration_days ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.duration_days.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="campaign_goal">Campaign goal</Label>
          <Textarea
            id="campaign_goal"
            rows={3}
            placeholder="What should this campaign achieve?"
            {...form.register("campaign_goal")}
          />
          {form.formState.errors.campaign_goal ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.campaign_goal.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="target_audience">Target audience (optional)</Label>
          <Textarea
            id="target_audience"
            rows={2}
            {...form.register("target_audience")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="seasonality">Seasonality (optional)</Label>
          <Input
            id="seasonality"
            placeholder="e.g. Summer, Back to school"
            {...form.register("seasonality")}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="extra_instructions">Extra instructions (optional)</Label>
          <Textarea
            id="extra_instructions"
            rows={3}
            {...form.register("extra_instructions")}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>Products & services (optional)</Label>
          <ProductMultiSelect
            products={products}
            value={form.watch("product_ids")}
            onChange={(ids) =>
              form.setValue("product_ids", ids, { shouldValidate: true })
            }
          />
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Saving...
          </>
        ) : isEdit ? (
          "Save changes"
        ) : (
          "Create campaign"
        )}
      </Button>
    </form>
  )
}

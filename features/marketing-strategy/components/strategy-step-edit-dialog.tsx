"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

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
import { updateStrategyStep } from "@/features/marketing-strategy/actions"
import {
  getAllowedContentTypes,
  STRATEGY_CONTENT_TYPE_LABELS,
  strategyStepEditSchema,
  type StrategyContentMode,
  type StrategyStep,
  type StrategyStepEditValues,
} from "@/lib/validations/marketing-campaign"

interface StrategyStepEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  step: StrategyStep
  campaignId: string
  contentMode: StrategyContentMode
  productNames: string[]
  onSaved: () => void
}

function getStepEditDefaults(
  step: StrategyStep,
  contentMode: StrategyContentMode,
): StrategyStepEditValues {
  const allowedTypes = getAllowedContentTypes(contentMode)

  return {
    content_type: allowedTypes.includes(
      step.content_type as (typeof allowedTypes)[number],
    )
      ? (step.content_type as StrategyStepEditValues["content_type"])
      : allowedTypes[0],
    topic: step.topic,
    objective: step.objective,
    product_reference: step.product_reference ?? "",
    notes: step.notes ?? "",
  }
}

function StrategyStepEditForm({
  step,
  campaignId,
  contentMode,
  productNames,
  onSaved,
  onClose,
}: {
  step: StrategyStep
  campaignId: string
  contentMode: StrategyContentMode
  productNames: string[]
  onSaved: () => void
  onClose: () => void
}) {
  const [isSaving, startSave] = useTransition()
  const allowedTypes = getAllowedContentTypes(contentMode)

  const form = useForm<StrategyStepEditValues>({
    resolver: zodResolver(strategyStepEditSchema),
    defaultValues: getStepEditDefaults(step, contentMode),
  })

  function onSubmit(values: StrategyStepEditValues) {
    startSave(async () => {
      const result = await updateStrategyStep(campaignId, step.day, values)

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success(`Day ${step.day} updated`)
      onClose()
      onSaved()
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {allowedTypes.length > 1 ? (
        <div className="space-y-2">
          <Label htmlFor={`content_type-${step.day}`}>Content type</Label>
          <Select
            value={form.watch("content_type")}
            onValueChange={(value) =>
              form.setValue(
                "content_type",
                value as StrategyStepEditValues["content_type"],
                { shouldValidate: true },
              )
            }
          >
            <SelectTrigger id={`content_type-${step.day}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowedTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {STRATEGY_CONTENT_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`topic-${step.day}`}>Topic</Label>
        <Input id={`topic-${step.day}`} {...form.register("topic")} />
        {form.formState.errors.topic ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.topic.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`objective-${step.day}`}>Objective</Label>
        <Textarea
          id={`objective-${step.day}`}
          rows={2}
          {...form.register("objective")}
        />
        {form.formState.errors.objective ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.objective.message}
          </p>
        ) : null}
      </div>

      {productNames.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor={`product_reference-${step.day}`}>
            Product (optional)
          </Label>
          <Select
            value={form.watch("product_reference") || "__none__"}
            onValueChange={(value) =>
              form.setValue(
                "product_reference",
                value === "__none__" ? "" : value,
                { shouldValidate: true },
              )
            }
          >
            <SelectTrigger id={`product_reference-${step.day}`}>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {productNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`notes-${step.day}`}>Notes (optional)</Label>
        <Textarea id={`notes-${step.day}`} rows={3} {...form.register("notes")} />
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function StrategyStepEditDialog({
  open,
  onOpenChange,
  step,
  campaignId,
  contentMode,
  productNames,
  onSaved,
}: StrategyStepEditDialogProps) {
  if (!open) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit day {step.day}</DialogTitle>
          <DialogDescription>
            Adjust this day&apos;s plan if the AI proposal doesn&apos;t fit.
          </DialogDescription>
        </DialogHeader>

        <StrategyStepEditForm
          key={`${step.day}-${step.topic}-${step.objective}-${step.notes ?? ""}`}
          step={step}
          campaignId={campaignId}
          contentMode={contentMode}
          productNames={productNames}
          onSaved={onSaved}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

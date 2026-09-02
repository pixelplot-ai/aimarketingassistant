"use client"

import { Loader2Icon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"

export function ConfirmDeleteDialog({
  title,
  description = "This cannot be undone.",
  confirmLabel = "Delete",
  saving = false,
  onCancel,
  onConfirm,
}: {
  title: string
  description?: string
  confirmLabel?: string
  saving?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Cancel delete"
        disabled={saving}
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        className="relative z-10 w-full max-w-sm rounded-xl border bg-background p-5 shadow-lg"
      >
        <h2
          id="confirm-delete-title"
          className="text-lg font-semibold tracking-tight"
        >
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving}
            className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500"
            onClick={onConfirm}
          >
            {saving ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <Trash2Icon />
            )}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

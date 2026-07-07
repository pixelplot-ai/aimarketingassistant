"use client"

import {
  Hash,
  Loader2,
  MessageSquarePlus,
  Minimize2,
  Maximize2,
  Pencil,
  Sparkles,
  Wand2,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  aiCustomInstruction,
  aiExpand,
  aiGenerateCaption,
  aiGenerateCta,
  aiGenerateHashtags,
  aiImproveWriting,
  aiRewrite,
  aiShorten,
  type ProductContext,
} from "@/features/posts/ai-actions"

type DialogMode = "custom" | null

type AiOperationKey =
  | "generate_caption"
  | "rewrite"
  | "improve_writing"
  | "generate_cta"
  | "generate_hashtags"
  | "expand"
  | "shorten"

interface AiTextToolbarProps {
  content: string
  platformIds: string[]
  postId?: string
  brandProfileComplete: boolean
  onContentChange: (value: string) => void
  disabled?: boolean
  productContext?: ProductContext | null
  strategyStep?: import("@/services/ai/types").StrategyStepPromptContext | null
}

export function AiTextToolbar({
  content,
  platformIds,
  postId,
  brandProfileComplete,
  onContentChange,
  disabled = false,
  productContext,
  strategyStep,
}: AiTextToolbarProps) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const [dialogMode, setDialogMode] = useState<DialogMode>(null)
  const [dialogInstruction, setDialogInstruction] = useState("")

  const isBusy = loadingKey !== null
  const aiDisabled = disabled || isBusy

  async function runDirectOperation(
    key: AiOperationKey,
    runner: () => Promise<{ success: boolean; data?: { text: string }; error?: string }>,
    options?: { append?: boolean },
  ) {
    setLoadingKey(key)

    const result = await runner()
    setLoadingKey(null)

    if (!result.success) {
      toast.error(result.error ?? "AI generation failed.")
      return
    }

    if (!result.data) {
      toast.error("AI generation failed.")
      return
    }

    if (options?.append) {
      const separator = content.trim().length > 0 ? "\n\n" : ""
      onContentChange(`${content.trim()}${separator}${result.data.text}`)
    } else {
      onContentChange(result.data.text)
    }

    toast.success("AI content applied.")
  }

  function baseInput(extra?: { userInstruction?: string }) {
    return {
      postContent: content,
      platformIds,
      postId: postId ?? null,
      productContext: productContext ?? null,
      strategyStep: strategyStep ?? null,
      ...extra,
    }
  }

  async function handleDialogSubmit() {
    if (dialogMode !== "custom") {
      return
    }

    if (!dialogInstruction.trim()) {
      toast.error("Enter an instruction for the AI.")
      return
    }

    setLoadingKey("custom")
    const result = await aiCustomInstruction(
      baseInput({ userInstruction: dialogInstruction.trim() }),
    )
    setLoadingKey(null)
    setDialogMode(null)
    setDialogInstruction("")

    if (!result.success) {
      toast.error(result.error ?? "AI generation failed.")
      return
    }

    if (!result.data) {
      toast.error("AI generation failed.")
      return
    }

    onContentChange(result.data.text)
    toast.success("AI content applied.")
  }

  return (
    <>
      {!brandProfileComplete ? (
        <Alert className="mb-2 py-2">
          <Sparkles className="size-4" />
          <AlertTitle>Brand profile recommended</AlertTitle>
          <AlertDescription>
            AI works without a brand profile, but results improve when you{" "}
            <Link href="/settings" className="font-medium underline">
              configure your Brand Profile
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={aiDisabled}
          onClick={() =>
            runDirectOperation("generate_caption", () =>
              aiGenerateCaption(baseInput()),
            )
          }
        >
          {loadingKey === "generate_caption" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          Generate
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={aiDisabled || !content.trim()}
          onClick={() =>
            runDirectOperation("rewrite", () => aiRewrite(baseInput()))
          }
        >
          {loadingKey === "rewrite" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Pencil className="size-3.5" />
          )}
          Rewrite
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={aiDisabled || !content.trim()}
          onClick={() =>
            runDirectOperation("improve_writing", () =>
              aiImproveWriting(baseInput()),
            )
          }
        >
          {loadingKey === "improve_writing" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Wand2 className="size-3.5" />
          )}
          Improve
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={aiDisabled}
          onClick={() =>
            runDirectOperation(
              "generate_cta",
              () => aiGenerateCta(baseInput()),
              { append: true },
            )
          }
        >
          {loadingKey === "generate_cta" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <MessageSquarePlus className="size-3.5" />
          )}
          CTA
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={aiDisabled}
          onClick={() =>
            runDirectOperation(
              "generate_hashtags",
              () => aiGenerateHashtags(baseInput()),
              { append: true },
            )
          }
        >
          {loadingKey === "generate_hashtags" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Hash className="size-3.5" />
          )}
          Hashtags
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={aiDisabled || !content.trim()}
          onClick={() =>
            runDirectOperation("expand", () => aiExpand(baseInput()))
          }
        >
          {loadingKey === "expand" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Maximize2 className="size-3.5" />
          )}
          Expand
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={aiDisabled || !content.trim()}
          onClick={() =>
            runDirectOperation("shorten", () => aiShorten(baseInput()))
          }
        >
          {loadingKey === "shorten" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Minimize2 className="size-3.5" />
          )}
          Shorten
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={aiDisabled}
          onClick={() => {
            setDialogInstruction("")
            setDialogMode("custom")
          }}
        >
          <Sparkles className="size-3.5" />
          Custom
        </Button>
      </div>

      <Dialog
        open={dialogMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDialogMode(null)
            setDialogInstruction("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Custom AI instruction</DialogTitle>
            <DialogDescription>
              Describe how the AI should transform or generate content.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="ai-instruction">Instruction</Label>
            <Textarea
              id="ai-instruction"
              rows={4}
              value={dialogInstruction}
              onChange={(event) => setDialogInstruction(event.target.value)}
              placeholder="e.g. Make it more playful and add a question at the end"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogMode(null)}
              disabled={isBusy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDialogSubmit}
              disabled={isBusy}
            >
              {isBusy ? <Loader2 className="size-4 animate-spin" /> : null}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
  UploadIcon,
  ExternalLinkIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
  SEEDANCE_AVATARS_BUCKET,
  type AvatarAssetRow,
  type AvatarRow,
} from "@/lib/avatars/types"
import { createClient } from "@/services/supabase/client"
import { cn } from "@/lib/utils"

interface AvatarsManagerProps {
  userId: string
}

const POLL_MS = 5000

export function AvatarsManager({ userId }: AvatarsManagerProps) {
  const searchParams = useSearchParams()
  const [avatars, setAvatars] = useState<AvatarRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [assets, setAssets] = useState<AvatarAssetRow[]>([])
  const [name, setName] = useState("Avatar")
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const selected = avatars.find((a) => a.id === selectedId) ?? null

  const loadAvatars = useCallback(async () => {
    const response = await fetch("/api/avatars")
    const data = (await response.json()) as {
      avatars?: AvatarRow[]
      error?: string
    }
    if (!response.ok) {
      throw new Error(data.error || "Could not load avatars")
    }
    setAvatars(data.avatars ?? [])
    return data.avatars ?? []
  }, [])

  const loadAssets = useCallback(async (avatarId: string) => {
    const response = await fetch(`/api/avatars/${avatarId}/assets`)
    const data = (await response.json()) as {
      assets?: AvatarAssetRow[]
      error?: string
    }
    if (!response.ok) {
      throw new Error(data.error || "Could not load assets")
    }
    setAssets(data.assets ?? [])

    const supabase = createClient()
    const nextPreviews: Record<string, string> = {}
    for (const asset of data.assets ?? []) {
      const { data: signed } = await supabase.storage
        .from(SEEDANCE_AVATARS_BUCKET)
        .createSignedUrl(asset.storage_path, 3600)
      if (signed?.signedUrl) {
        nextPreviews[asset.id] = signed.signedUrl
      }
    }
    setPreviewUrls(nextPreviews)
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const list = await loadAvatars()
        const verifiedId = searchParams.get("verified")
        const error = searchParams.get("error")
        if (error) {
          toast.error(`Verification issue: ${error}`)
        }
        if (verifiedId) {
          setSelectedId(verifiedId)
          toast.success("Avatar verified")
        } else if (list[0]) {
          setSelectedId(list[0].id)
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load")
      } finally {
        setLoading(false)
      }
    })()
  }, [loadAvatars, searchParams])

  useEffect(() => {
    if (!selectedId) {
      setAssets([])
      return
    }
    void loadAssets(selectedId).catch((err) => {
      toast.error(err instanceof Error ? err.message : "Failed to load assets")
    })
  }, [selectedId, loadAssets])

  useEffect(() => {
    if (!selectedId) return
    const hasPending =
      selected?.status === "pending_verification" ||
      assets.some((a) => a.status === "processing")
    if (!hasPending) return

    const timer = window.setInterval(() => {
      void loadAvatars().catch(() => undefined)
      void loadAssets(selectedId).catch(() => undefined)
    }, POLL_MS)

    return () => window.clearInterval(timer)
  }, [selectedId, selected?.status, assets, loadAvatars, loadAssets])

  async function startVerification() {
    setBusy(true)
    try {
      const response = await fetch("/api/avatars/verify/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "Avatar" }),
      })
      const data = (await response.json()) as {
        avatarId?: string
        h5Link?: string
        error?: string
      }
      if (!response.ok || !data.avatarId || !data.h5Link) {
        throw new Error(data.error || "Could not start verification")
      }

      await loadAvatars()
      setSelectedId(data.avatarId)
      window.open(data.h5Link, "_blank", "noopener,noreferrer")
      toast.message("Complete verification in the new tab (preferably on phone)")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed")
    } finally {
      setBusy(false)
    }
  }

  async function uploadPortraits(fileList: FileList | null) {
    if (!selected || selected.status !== "verified") {
      toast.error("Verify the avatar before uploading portraits.")
      return
    }
    if (!fileList?.length) return

    setBusy(true)
    const supabase = createClient()
    const stamp = Date.now()

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i]
        if (!file.type.startsWith("image/")) continue
        const ext = file.name.split(".").pop() || "jpg"
        const path = `${userId}/${selected.id}/${stamp}-${i}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from(SEEDANCE_AVATARS_BUCKET)
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          })
        if (uploadError) throw new Error(uploadError.message)

        const response = await fetch(`/api/avatars/${selected.id}/assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storagePath: path,
            name: file.name.slice(0, 64) || "Portrait",
          }),
        })
        const data = (await response.json()) as { error?: string }
        if (!response.ok) {
          throw new Error(data.error || "ModelArk asset upload failed")
        }
      }
      await loadAssets(selected.id)
      toast.success("Portraits submitted to ModelArk")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        Loading avatars…
      </div>
    )
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Avatars</CardTitle>
          <CardDescription>
            Verify a person once, then upload matching portraits.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="avatar-name">Name</Label>
            <Input
              id="avatar-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              placeholder="e.g. Ana"
            />
            <Button
              type="button"
              disabled={busy}
              onClick={() => void startVerification()}
            >
              {busy ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <PlusIcon />
              )}
              New verified avatar
            </Button>
          </div>

          <div className="flex flex-col gap-1">
            {avatars.length === 0 ? (
              <p className="text-sm text-muted-foreground">No avatars yet.</p>
            ) : (
              avatars.map((avatar) => (
                <button
                  key={avatar.id}
                  type="button"
                  onClick={() => setSelectedId(avatar.id)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    selectedId === avatar.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50",
                  )}
                >
                  <div className="font-medium">{avatar.name || "Untitled"}</div>
                  <div className="text-xs capitalize text-muted-foreground">
                    {avatar.status.replaceAll("_", " ")}
                  </div>
                </button>
              ))
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void loadAvatars()
                .then(() =>
                  selectedId ? loadAssets(selectedId) : Promise.resolve(),
                )
                .catch((err) =>
                  toast.error(
                    err instanceof Error ? err.message : "Refresh failed",
                  ),
                )
            }}
          >
            <RefreshCwIcon />
            Refresh
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {selected ? selected.name || "Avatar" : "Select an avatar"}
          </CardTitle>
          <CardDescription>
            {selected?.status === "pending_verification"
              ? "Finish the ModelArk H5 verification (open on phone if possible)."
              : selected?.status === "verified"
                ? "Upload portraits that match the verified face."
                : "Create or select an avatar to manage portraits."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!selected ? (
            <p className="text-sm text-muted-foreground">
              Choose an avatar from the list or create a new one.
            </p>
          ) : null}

          {selected?.status === "pending_verification" ? (
            <Alert>
              <ExternalLinkIcon />
              <AlertTitle>Waiting for verification</AlertTitle>
              <AlertDescription>
                Complete the liveness check in the ModelArk tab. This page
                refreshes automatically. Verification is once per person.
              </AlertDescription>
            </Alert>
          ) : null}

          {selected?.status === "failed" ? (
            <Alert variant="destructive">
              <AlertTitle>Verification failed</AlertTitle>
              <AlertDescription>
                {selected.error || "Try creating a new avatar."}
              </AlertDescription>
            </Alert>
          ) : null}

          {selected?.status === "verified" ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Group: {selected.ark_group_id}
                </p>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  <UploadIcon />
                  Upload portraits
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void uploadPortraits(e.target.files)
                    e.target.value = ""
                  }}
                />
              </div>

              {assets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No portraits yet. Only Active images can be used on Generate.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {assets.map((asset) => (
                    <div
                      key={asset.id}
                      className="overflow-hidden rounded-lg border"
                    >
                      {previewUrls[asset.id] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previewUrls[asset.id]}
                          alt={asset.name}
                          className="aspect-square w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-square items-center justify-center bg-muted text-xs text-muted-foreground">
                          No preview
                        </div>
                      )}
                      <div className="space-y-0.5 p-2">
                        <p className="truncate text-xs font-medium">
                          {asset.name}
                        </p>
                        <p className="text-[11px] capitalize text-muted-foreground">
                          {asset.status}
                        </p>
                        {asset.error ? (
                          <p className="text-[11px] text-destructive">
                            {asset.error}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

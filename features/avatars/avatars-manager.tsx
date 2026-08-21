"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
  UploadIcon,
} from "lucide-react"
import { toast } from "sonner"

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
  const [avatars, setAvatars] = useState<AvatarRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [assets, setAssets] = useState<AvatarAssetRow[]>([])
  const [name, setName] = useState("brand_characters")
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
      throw new Error(data.error || "Could not load groups")
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
        const ready = list.find((a) => a.status === "verified" && a.ark_group_id)
        setSelectedId(ready?.id ?? list[0]?.id ?? null)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load")
      } finally {
        setLoading(false)
      }
    })()
  }, [loadAvatars])

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
    if (!assets.some((a) => a.status === "processing")) return

    const timer = window.setInterval(() => {
      void loadAssets(selectedId).catch(() => undefined)
    }, POLL_MS)

    return () => window.clearInterval(timer)
  }, [selectedId, assets, loadAssets])

  async function createGroup() {
    setBusy(true)
    try {
      const response = await fetch("/api/avatars/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "brand_characters" }),
      })
      const data = (await response.json()) as {
        avatarId?: string
        error?: string
      }
      if (!response.ok || !data.avatarId) {
        throw new Error(data.error || "Could not create asset group")
      }

      await loadAvatars()
      setSelectedId(data.avatarId)
      toast.success("AIGC asset group created")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed")
    } finally {
      setBusy(false)
    }
  }

  async function uploadAssets(fileList: FileList | null) {
    if (!selected || selected.status !== "verified" || !selected.ark_group_id) {
      toast.error("Create an asset group first.")
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
            name: file.name.replace(/\.[^.]+$/, "").slice(0, 64) || "asset",
          }),
        })
        const data = (await response.json()) as { error?: string }
        if (!response.ok) {
          throw new Error(data.error || "CreateAsset failed")
        }
      }
      await loadAssets(selected.id)
      toast.success("Uploaded — wait until status is Active")
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
        Loading asset library…
      </div>
    )
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Asset groups</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="group-name">Group name</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              placeholder="e.g. brand_characters"
            />
            <Button
              type="button"
              disabled={busy}
              onClick={() => void createGroup()}
            >
              {busy ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <PlusIcon />
              )}
              New AIGC group
            </Button>
          </div>

          <div className="flex flex-col gap-1">
            {avatars.length === 0 ? (
              <p className="text-sm text-muted-foreground">No groups yet.</p>
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
                  <div className="text-xs text-muted-foreground">
                    {avatar.status === "verified" && avatar.ark_group_id
                      ? "Ready"
                      : avatar.status.replaceAll("_", " ")}
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
            {selected ? selected.name || "Group" : "Select a group"}
          </CardTitle>
          <CardDescription>
            Upload images into the group. When status is Active, pick them on
            Generate as asset:// refs.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!selected ? (
            <p className="text-sm text-muted-foreground">
              Create a group (e.g. brand_characters), then upload images.
            </p>
          ) : null}

          {selected && selected.status !== "verified" ? (
            <p className="text-sm text-destructive">
              {selected.error ||
                "This group is not ready. Create a new AIGC group (old real-human groups won’t work for AI assets)."}
            </p>
          ) : null}

          {selected?.status === "verified" && selected.ark_group_id ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm text-muted-foreground">
                  {selected.ark_group_id}
                </p>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  <UploadIcon />
                  Upload images
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void uploadAssets(e.target.files)
                    e.target.value = ""
                  }}
                />
              </div>

              {assets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No assets yet. Only Active assets appear on Generate.
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

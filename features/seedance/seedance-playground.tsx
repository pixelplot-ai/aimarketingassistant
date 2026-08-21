"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2Icon, Trash2Icon, UploadIcon, XIcon } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import {
  AUDIO_ACCEPT,
  CLIP_DURATION_DEFAULT,
  CLIP_DURATION_MAX,
  CLIP_DURATION_MIN,
  CLIP_QUALITIES,
  IMAGE_ACCEPT,
  MAX_REFERENCE_IMAGES,
  SEEDANCE_MODELS,
  SEEDANCE_RATIOS,
  SEEDANCE_REFS_BUCKET,
  type ClipDuration,
  type ClipQuality,
  type SeedanceModelOption,
  type SeedanceRatio,
} from "@/lib/seedance/constants"
import type { SeedanceJobRow } from "@/lib/seedance/types"
import { createClient } from "@/services/supabase/client"
import { cn } from "@/lib/utils"

interface LocalImage {
  id: string
  file: File
  previewUrl: string
  path?: string
}

interface ActiveAvatarAsset {
  id: string
  name: string
  avatar_name: string
  storage_path: string
  ark_asset_id: string | null
  asset_uri: string | null
  previewUrl?: string
}

interface SeedancePlaygroundProps {
  userId: string
}

const POLL_MS = 8000

function OptionChips<T extends string | number>({
  label,
  options,
  selected,
  optionLabel,
  disabled,
  onSelect,
}: {
  label: string
  options: readonly T[]
  selected: T
  optionLabel: (option: T) => string
  disabled: boolean
  onSelect: (option: T) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={String(option)}
            type="button"
            size="sm"
            variant={option === selected ? "default" : "outline"}
            disabled={disabled}
            aria-pressed={option === selected}
            onClick={() => onSelect(option)}
            className="h-8 text-xs"
          >
            {optionLabel(option)}
          </Button>
        ))}
      </div>
    </div>
  )
}

export function SeedancePlayground({ userId }: SeedancePlaygroundProps) {
  const [prompt, setPrompt] = useState("")
  const [images, setImages] = useState<LocalImage[]>([])
  const [selectedAvatarIds, setSelectedAvatarIds] = useState<string[]>([])
  const [activeAvatars, setActiveAvatars] = useState<ActiveAvatarAsset[]>([])
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [audioPath, setAudioPath] = useState<string | null>(null)
  const [modelOptionId, setModelOptionId] =
    useState<SeedanceModelOption>("seedance_2_5")
  const [durationSeconds, setDurationSeconds] =
    useState<ClipDuration>(CLIP_DURATION_DEFAULT)
  const [ratio, setRatio] = useState<SeedanceRatio>("9:16")
  const [quality, setQuality] = useState<ClipQuality>("standard")
  const [generateAudio, setGenerateAudio] = useState(true)
  const [busy, setBusy] = useState(false)
  const [job, setJob] = useState<SeedanceJobRow | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)

  const totalRefs = images.length + selectedAvatarIds.length

  const busyOrRunning = useMemo(() => {
    return (
      busy ||
      job?.status === "queued" ||
      job?.status === "processing"
    )
  }, [busy, job?.status])

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/avatars/active-assets")
        const data = (await response.json()) as {
          assets?: ActiveAvatarAsset[]
        }
        if (!response.ok) return
        const list = data.assets ?? []
        const supabase = createClient()
        const withPreviews: ActiveAvatarAsset[] = []
        for (const asset of list) {
          const { data: signed } = await supabase.storage
            .from("seedance-avatars")
            .createSignedUrl(asset.storage_path, 3600)
          withPreviews.push({
            ...asset,
            previewUrl: signed?.signedUrl,
          })
        }
        setActiveAvatars(withPreviews)
      } catch {
        // optional picker
      }
    })()
  }, [])

  useEffect(() => {
    return () => {
      for (const image of images) {
        URL.revokeObjectURL(image.previewUrl)
      }
    }
  }, [images])

  const refreshJob = useCallback(async (jobId: string) => {
    const response = await fetch(`/api/seedance/jobs/${jobId}`)
    const data = (await response.json()) as {
      job?: SeedanceJobRow
      error?: string
    }
    if (!response.ok) {
      throw new Error(data.error || "Could not load job status")
    }
    if (data.job) {
      setJob(data.job)
    }
  }, [])

  useEffect(() => {
    if (!job?.id) return
    if (job.status === "succeeded" || job.status === "failed") return

    const supabase = createClient()
    const channel = supabase
      .channel(`seedance-job-${job.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "seedance_jobs",
          filter: `id=eq.${job.id}`,
        },
        (payload) => {
          setJob(payload.new as SeedanceJobRow)
        },
      )
      .subscribe()

    const timer = window.setInterval(() => {
      void refreshJob(job.id).catch((err) => {
        console.error("[seedance] poll failed:", err)
      })
    }, POLL_MS)

    return () => {
      window.clearInterval(timer)
      void supabase.removeChannel(channel)
    }
  }, [job?.id, job?.status, refreshJob])

  function addImages(fileList: FileList | null) {
    if (!fileList?.length) return
    const remaining = MAX_REFERENCE_IMAGES - totalRefs
    if (remaining <= 0) {
      toast.error(`You can use at most ${MAX_REFERENCE_IMAGES} reference images.`)
      return
    }

    const next = Array.from(fileList)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, remaining)
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      }))

    if (next.length === 0) {
      toast.error("Only JPEG, PNG, or WebP images are supported.")
      return
    }

    setImages((prev) => [...prev, ...next])
  }

  function removeImage(id: string) {
    setImages((prev) => {
      const target = prev.find((image) => image.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((image) => image.id !== id)
    })
  }

  function onAudioSelected(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return
    if (!file.type.startsWith("audio/")) {
      toast.error("Only WAV or MP3 audio is supported.")
      return
    }
    setAudioFile(file)
    setAudioPath(null)
  }

  function toggleAvatar(assetId: string) {
    setSelectedAvatarIds((prev) => {
      if (prev.includes(assetId)) {
        return prev.filter((id) => id !== assetId)
      }
      if (prev.length + images.length >= MAX_REFERENCE_IMAGES) {
        toast.error(`You can use at most ${MAX_REFERENCE_IMAGES} reference images.`)
        return prev
      }
      return [...prev, assetId]
    })
  }

  async function uploadRefs(): Promise<{
    imagePaths: string[]
    audioPath: string | null
  }> {
    const supabase = createClient()
    const stamp = Date.now()
    const imagePaths: string[] = []

    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      const ext = image.file.name.split(".").pop() || "jpg"
      const path = `${userId}/${stamp}-image-${i + 1}.${ext}`
      const { error } = await supabase.storage
        .from(SEEDANCE_REFS_BUCKET)
        .upload(path, image.file, {
          cacheControl: "3600",
          upsert: false,
          contentType: image.file.type,
        })
      if (error) {
        throw new Error(error.message)
      }
      imagePaths.push(path)
    }

    let nextAudioPath: string | null = audioPath
    if (audioFile && !audioPath) {
      const ext = audioFile.name.split(".").pop() || "mp3"
      const path = `${userId}/${stamp}-audio.${ext}`
      const { error } = await supabase.storage
        .from(SEEDANCE_REFS_BUCKET)
        .upload(path, audioFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: audioFile.type,
        })
      if (error) {
        throw new Error(error.message)
      }
      nextAudioPath = path
      setAudioPath(path)
    }

    return { imagePaths, audioPath: nextAudioPath }
  }

  async function onGenerate() {
    if (!prompt.trim()) {
      toast.error("Enter a prompt.")
      return
    }

    setBusy(true)
    setJob(null)

    try {
      const { imagePaths, audioPath: uploadedAudioPath } = await uploadRefs()
      const assetUris = selectedAvatarIds
        .map(
          (id) =>
            activeAvatars.find((asset) => asset.id === id)?.asset_uri ?? null,
        )
        .filter((uri): uri is string => Boolean(uri))

      const response = await fetch("/api/seedance/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          imagePaths,
          assetUris,
          audioPath: uploadedAudioPath,
          modelOptionId,
          durationSeconds,
          ratio,
          quality,
          generateAudio,
        }),
      })

      const data = (await response.json()) as {
        jobId?: string
        error?: string
      }

      if (!response.ok || !data.jobId) {
        throw new Error(data.error || "Failed to start generation")
      }

      await refreshJob(data.jobId)
      toast.success("Generation started")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start generation"
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Prompt</CardTitle>
            <CardDescription>
              Describe the video. Reference images become @Image1…@Image9;
              audio becomes @Audio1.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="A product hero shot on a marble counter, slow camera push-in, soft daylight…"
              rows={8}
              disabled={busyOrRunning}
            />

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label>
                  Reference images ({totalRefs}/{MAX_REFERENCE_IMAGES})
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busyOrRunning || totalRefs >= MAX_REFERENCE_IMAGES}
                  onClick={() => imageInputRef.current?.click()}
                >
                  <UploadIcon />
                  Add images
                </Button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept={IMAGE_ACCEPT}
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    addImages(event.target.files)
                    event.target.value = ""
                  }}
                />
              </div>

              {activeAvatars.length > 0 ? (
                <div className="flex flex-col gap-2 rounded-lg border p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Pick from verified avatars
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                    {activeAvatars.map((asset) => {
                      const selected = selectedAvatarIds.includes(asset.id)
                      return (
                        <button
                          key={asset.id}
                          type="button"
                          disabled={
                            busyOrRunning ||
                            (!selected && totalRefs >= MAX_REFERENCE_IMAGES)
                          }
                          onClick={() => toggleAvatar(asset.id)}
                          className={cn(
                            "relative overflow-hidden rounded-lg border text-left",
                            selected
                              ? "ring-2 ring-primary"
                              : "opacity-90 hover:opacity-100",
                          )}
                        >
                          {asset.previewUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={asset.previewUrl}
                              alt={asset.name}
                              className="aspect-square w-full object-cover"
                            />
                          ) : (
                            <div className="flex aspect-square items-center justify-center bg-muted text-[10px]">
                              Avatar
                            </div>
                          )}
                          <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-[10px] text-white">
                            {asset.avatar_name}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {images.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {images.map((image, index) => (
                    <div
                      key={image.id}
                      className="relative overflow-hidden rounded-lg border bg-muted"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.previewUrl}
                        alt={`Reference ${index + 1}`}
                        className="aspect-square w-full object-cover"
                      />
                      <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                        @Image{selectedAvatarIds.length + index + 1}
                      </span>
                      <button
                        type="button"
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                        onClick={() => removeImage(image.id)}
                        disabled={busyOrRunning}
                        aria-label={`Remove image ${index + 1}`}
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Optional. Verified avatars and/or up to 9 JPEG/PNG/WebP files.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Reference audio</Label>
                <div className="flex gap-2">
                  {audioFile || audioPath ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busyOrRunning}
                      onClick={() => {
                        setAudioFile(null)
                        setAudioPath(null)
                      }}
                    >
                      <Trash2Icon />
                      Remove
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyOrRunning}
                    onClick={() => audioInputRef.current?.click()}
                  >
                    <UploadIcon />
                    {audioFile ? "Replace" : "Add audio"}
                  </Button>
                </div>
                <input
                  ref={audioInputRef}
                  type="file"
                  accept={AUDIO_ACCEPT}
                  className="hidden"
                  onChange={(event) => {
                    onAudioSelected(event.target.files)
                    event.target.value = ""
                  }}
                />
              </div>
              {audioFile ? (
                <p className="text-sm text-muted-foreground">
                  @Audio1 — {audioFile.name}
                  {" · "}
                  duration picker is ignored (Seedance follows the audio)
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Optional. One WAV or MP3 file.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <OptionChips
              label="Model"
              options={SEEDANCE_MODELS.map((model) => model.id)}
              selected={modelOptionId}
              optionLabel={(id) =>
                SEEDANCE_MODELS.find((model) => model.id === id)?.label ?? id
              }
              disabled={busyOrRunning}
              onSelect={(id) => {
                setModelOptionId(id)
                if (id === "seedance_2_0_fast") {
                  setQuality("standard")
                }
              }}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="duration-seconds" className="text-xs text-muted-foreground font-normal">
                Duration (seconds)
              </Label>
              <Input
                id="duration-seconds"
                type="number"
                min={CLIP_DURATION_MIN}
                max={CLIP_DURATION_MAX}
                step={1}
                value={durationSeconds}
                disabled={busyOrRunning || Boolean(audioFile)}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  if (!Number.isFinite(next)) return
                  setDurationSeconds(
                    Math.min(
                      CLIP_DURATION_MAX,
                      Math.max(CLIP_DURATION_MIN, Math.round(next)),
                    ),
                  )
                }}
                className="w-28"
              />
              <p className="text-xs text-muted-foreground">
                {CLIP_DURATION_MIN}–{CLIP_DURATION_MAX}s
                {audioFile
                  ? " · ignored when reference audio is attached"
                  : null}
              </p>
            </div>
            <OptionChips
              label="Format"
              options={SEEDANCE_RATIOS}
              selected={ratio}
              optionLabel={(value) => value}
              disabled={busyOrRunning}
              onSelect={setRatio}
            />
            <OptionChips
              label="Quality"
              options={CLIP_QUALITIES}
              selected={quality}
              optionLabel={(value) =>
                value === "pro" ? "Pro 1080p" : "Standard 720p"
              }
              disabled={busyOrRunning || modelOptionId === "seedance_2_0_fast"}
              onSelect={setQuality}
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Native audio</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={generateAudio ? "default" : "outline"}
                  disabled={busyOrRunning}
                  onClick={() => setGenerateAudio(true)}
                  className="h-8 text-xs"
                >
                  On
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={!generateAudio ? "default" : "outline"}
                  disabled={busyOrRunning}
                  onClick={() => setGenerateAudio(false)}
                  className="h-8 text-xs"
                >
                  Off
                </Button>
              </div>
            </div>

            <Button
              type="button"
              size="lg"
              disabled={busyOrRunning || !prompt.trim()}
              onClick={() => void onGenerate()}
              className="w-full"
            >
              {busyOrRunning ? (
                <>
                  <Loader2Icon className="animate-spin" />
                  Generating…
                </>
              ) : (
                "Generate video"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className={cn("h-fit")}>
        <CardHeader>
          <CardTitle>Result</CardTitle>
          <CardDescription>
            Status updates via webhook + Realtime, with an 8s poll backup.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!job ? (
            <p className="text-sm text-muted-foreground">
              No generation yet. Submit a prompt to start.
            </p>
          ) : null}

          {job ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium capitalize">{job.status}</span>
              </div>

              {job.status === "queued" || job.status === "processing" ? (
                <Alert>
                  <Loader2Icon className="animate-spin" />
                  <AlertTitle>Rendering</AlertTitle>
                  <AlertDescription>
                    ModelArk is generating the clip. You can leave this page —
                    the job is saved.
                  </AlertDescription>
                </Alert>
              ) : null}

              {job.status === "failed" ? (
                <Alert variant="destructive">
                  <AlertTitle>Generation failed</AlertTitle>
                  <AlertDescription>
                    {job.error || "Unknown error"}
                  </AlertDescription>
                </Alert>
              ) : null}

              {job.status === "succeeded" && job.output_url ? (
                <div className="flex flex-col gap-3">
                  <video
                    key={job.output_url}
                    src={job.output_url}
                    controls
                    className="w-full rounded-lg border bg-black"
                  />
                  <a
                    href={job.output_url}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      "inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted",
                    )}
                  >
                    Download MP4
                  </a>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

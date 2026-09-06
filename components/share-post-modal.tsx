"use client"

import { BaseMediaModal } from "@/components/ui/base-media-modal"
import { Button } from "@/components/ui/button"
import {
  canvasToPngBlob,
  copyPngToClipboard,
  copyTextToClipboard,
  downloadPng,
  getSharePostFilename,
  renderShareCard,
  type SharePostMedia,
} from "@/lib/share-post"
import {
  Copy01Icon,
  Download01Icon,
  Image01Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { usePreferences } from "@/hooks/use-preferences"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

interface SharePostModalProps {
  isOpen: boolean
  onClose: () => void
  media: SharePostMedia
  caption: string
}

/**
 * Preview + copy/download modal for a generated share post image.
 * Mirrors the mobile ShareCardModal flow (preview, copy caption, save),
 * with web clipboard image copy plus a download fallback.
 */
export function SharePostModal({
  isOpen,
  onClose,
  media,
  caption,
}: SharePostModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCopyingImage, setIsCopyingImage] = useState(false)
  const [isCopyingCaption, setIsCopyingCaption] = useState(false)
  const blobRef = useRef<Blob | null>(null)
  const urlsRef = useRef<string[]>([])
  const { preferences } = usePreferences()
  const accentColor = preferences.accentColor

  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    setIsGenerating(true)
    setPreviewUrl(null)
    blobRef.current = null

    renderShareCard(media, { accentColor })
      .then(async (canvas) => {
        if (cancelled) return
        const blob = await canvasToPngBlob(canvas)
        if (cancelled) return
        blobRef.current = blob
        const url = URL.createObjectURL(blob)
        urlsRef.current.push(url)
        setPreviewUrl(url)
      })
      .catch((error) => {
        console.error("Failed to generate share image:", error)
        if (!cancelled) {
          toast.error("Failed to generate share image. Please try again.")
        }
      })
      .finally(() => {
        if (!cancelled) setIsGenerating(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, media, accentColor])

  useEffect(() => {
    const urls = urlsRef.current
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
      urlsRef.current = []
    }
  }, [])

  const handleCopyImage = useCallback(async () => {
    if (!blobRef.current) return

    setIsCopyingImage(true)
    try {
      await copyPngToClipboard(blobRef.current)
      toast.success("Image copied to clipboard")
    } catch {
      // Clipboard image copy unsupported (e.g. Safari/Firefox):
      // fall back to downloading the file instead.
      downloadPng(blobRef.current, getSharePostFilename(media))
      toast.info("Image copy not supported here — downloaded instead")
    } finally {
      setIsCopyingImage(false)
    }
  }, [media])

  const handleCopyCaption = useCallback(async () => {
    setIsCopyingCaption(true)
    try {
      await copyTextToClipboard(caption)
      toast.success("Caption copied to clipboard")
    } catch (error) {
      console.error("Failed to copy caption:", error)
      toast.error("Failed to copy caption. Please try again.")
    } finally {
      setIsCopyingCaption(false)
    }
  }, [caption])

  const handleDownload = useCallback(() => {
    if (!blobRef.current) return
    downloadPng(blobRef.current, getSharePostFilename(media))
    toast.success("Image downloaded")
  }, [media])

  const isBusy = isGenerating || isCopyingImage || isCopyingCaption

  return (
    <BaseMediaModal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Share Post"
      description="Copy the image and caption to share this title anywhere."
      maxWidth="sm:max-w-md"
    >
      <div className="flex flex-col gap-4">
        <div className="flex min-h-[280px] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {isGenerating || !previewUrl ? (
            <div className="flex items-center gap-3 text-white/70">
              <HugeiconsIcon
                icon={Loading03Icon}
                className="size-5 animate-spin"
              />
              <span>Generating image...</span>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={`${media.title} share post preview`}
              className="max-h-[50vh] w-auto object-contain"
              data-testid="share-post-preview"
            />
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-xs font-medium text-white/45">Caption</p>
          <p className="mt-1 text-sm text-white/85" data-testid="share-post-caption">
            {caption}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => void handleCopyImage()}
            disabled={!previewUrl || isBusy}
            data-testid="share-post-copy-image"
          >
            {isCopyingImage ? (
              <HugeiconsIcon
                icon={Loading03Icon}
                className="size-4 animate-spin"
              />
            ) : (
              <HugeiconsIcon icon={Image01Icon} className="size-4" />
            )}
            Copy image
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleCopyCaption()}
            disabled={isBusy}
            data-testid="share-post-copy-caption"
          >
            {isCopyingCaption ? (
              <HugeiconsIcon
                icon={Loading03Icon}
                className="size-4 animate-spin"
              />
            ) : (
              <HugeiconsIcon icon={Copy01Icon} className="size-4" />
            )}
            Copy caption
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleDownload}
            disabled={!previewUrl || isBusy}
            data-testid="share-post-download"
          >
            <HugeiconsIcon icon={Download01Icon} className="size-4" />
            Download
          </Button>
        </div>
      </div>
    </BaseMediaModal>
  )
}

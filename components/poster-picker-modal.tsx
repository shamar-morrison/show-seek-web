"use client"

import { BaseMediaModal } from "@/components/ui/base-media-modal"
import { Button } from "@/components/ui/button"
import { usePosterOverrides } from "@/hooks/use-poster-overrides"
import { usePreferences } from "@/hooks/use-preferences"
import { useMediaImageCatalog } from "@/hooks/use-tmdb-queries"
import { buildImageUrl } from "@/lib/tmdb"
import type { PosterOverrideMediaType } from "@/lib/poster-overrides"
import type { TMDBLogo } from "@/types/tmdb"
import { CheckmarkCircle02Icon, Image01Icon, Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

interface PosterPickerModalProps {
  isOpen: boolean
  onClose: () => void
  mediaId: number
  mediaType: PosterOverrideMediaType
  title: string
  defaultPosterPath: string | null
}

function dedupePosters(posters: TMDBLogo[]): TMDBLogo[] {
  const seen = new Set<string>()
  const deduped: TMDBLogo[] = []

  for (const poster of posters) {
    if (!poster.file_path || seen.has(poster.file_path)) {
      continue
    }

    seen.add(poster.file_path)
    deduped.push(poster)
  }

  return deduped
}

export function PosterPickerModal({
  isOpen,
  onClose,
  mediaId,
  mediaType,
  title,
  defaultPosterPath,
}: PosterPickerModalProps) {
  const { setPosterOverride, clearPosterOverride } = usePreferences()
  const { resolvePosterPath } = usePosterOverrides()
  const { data, isLoading, isError, isFetching, refetch } = useMediaImageCatalog(
    mediaId,
    mediaType,
    isOpen,
  )
  const [selectedPosterPath, setSelectedPosterPath] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const activePosterPath = useMemo(
    () => resolvePosterPath(mediaType, mediaId, defaultPosterPath),
    [defaultPosterPath, mediaId, mediaType, resolvePosterPath],
  )

  const posterOptions = useMemo(
    () => dedupePosters(data?.posters ?? []),
    [data?.posters],
  )

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setSelectedPosterPath(activePosterPath)
  }, [activePosterPath, isOpen])

  const hasChanges = selectedPosterPath !== activePosterPath

  const handleUseDefault = useCallback(() => {
    setSelectedPosterPath(defaultPosterPath)
  }, [defaultPosterPath])

  const handleSave = useCallback(async () => {
    if (!hasChanges) {
      onClose()
      return
    }

    setIsSaving(true)

    try {
      const shouldClear =
        !selectedPosterPath || selectedPosterPath === defaultPosterPath

      if (shouldClear) {
        await clearPosterOverride(mediaType, mediaId)
        toast.success("Default poster restored")
      } else {
        await setPosterOverride(mediaType, mediaId, selectedPosterPath)
        toast.success("Poster updated")
      }

      onClose()
    } catch (error) {
      console.error("Failed to update poster override:", error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update poster. Please try again.",
      )
    } finally {
      setIsSaving(false)
    }
  }, [
    clearPosterOverride,
    defaultPosterPath,
    hasChanges,
    mediaId,
    mediaType,
    onClose,
    selectedPosterPath,
    setPosterOverride,
  ])

  const subtitle =
    mediaType === "movie"
      ? "Pick a custom poster for this movie."
      : "Pick a custom poster for this TV show."

  return (
    <BaseMediaModal
      isOpen={isOpen}
      onClose={onClose}
      title="Change Poster"
      description={`${title}. ${subtitle}`}
      maxWidth="sm:max-w-5xl"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleUseDefault}
            disabled={isSaving}
            data-testid="poster-picker-use-default"
          >
            Use Default
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            data-testid="poster-picker-save-button"
          >
            {isSaving ? (
              <>
                <HugeiconsIcon
                  icon={Loading03Icon}
                  className="size-4 animate-spin"
                />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>

        {isLoading || (isFetching && !data) ? (
          <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-white/70">
            <div className="flex items-center gap-3">
              <HugeiconsIcon icon={Loading03Icon} className="size-5 animate-spin" />
              <span>Loading posters...</span>
            </div>
          </div>
        ) : isError ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-6 text-center">
            <p className="max-w-md text-sm text-white/75">
              Failed to load posters for this title.
            </p>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => void refetch()}>
                Try Again
              </Button>
              <Button type="button" variant="ghost" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        ) : posterOptions.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-6 text-center text-white/65">
            <HugeiconsIcon icon={Image01Icon} className="size-8" />
            <p>No posters available for this title.</p>
          </div>
        ) : (
          <div className="max-h-[65vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {posterOptions.map((poster) => {
                const isSelected = selectedPosterPath === poster.file_path
                const posterUrl = buildImageUrl(poster.file_path, "w500")

                const handleSelect = () => setSelectedPosterPath(poster.file_path)

                return (
                  <div
                    key={poster.file_path}
                    role="button"
                    tabIndex={0}
                    onClick={handleSelect}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        handleSelect()
                      }
                    }}
                    className={[
                      "group relative aspect-2/3 w-full cursor-pointer overflow-hidden rounded-2xl border bg-gray-900 text-left transition-all",
                      isSelected
                        ? "border-primary ring-2 ring-primary/60"
                        : "border-white/10 hover:border-white/20",
                    ].join(" ")}
                    data-testid={`poster-picker-option-${poster.file_path}`}
                    aria-pressed={isSelected}
                  >
                    {posterUrl ? (
                      <img
                        src={posterUrl}
                        alt={`${title} poster option`}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 20vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-sm text-white/45">
                        No poster
                      </div>
                    )}
                    {isSelected ? (
                      <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-white shadow-lg">
                        <HugeiconsIcon
                          icon={CheckmarkCircle02Icon}
                          className="size-3.5 fill-white text-white"
                        />
                        Selected
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </BaseMediaModal>
  )
}

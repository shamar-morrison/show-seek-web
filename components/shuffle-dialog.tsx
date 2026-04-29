"use client"

import { BaseMediaModal } from "@/components/ui/base-media-modal"
import { Button } from "@/components/ui/button"
import { ImageWithFallback } from "@/components/ui/image-with-fallback"
import { buildImageUrl } from "@/lib/tmdb"
import { getMediaUrl } from "@/lib/utils"
import type { ListMediaItem } from "@/types/list"
import { ShuffleIcon, StarIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

interface ShuffleDialogProps {
  isOpen: boolean
  onClose: () => void
  items: ListMediaItem[]
}

const ANIMATION_DURATION_MS = 2000
const START_DELAY_MS = 300
const MIN_INTERVAL_MS = 80
const MAX_INTERVAL_MS = 400

export function ShuffleDialog({
  isOpen,
  onClose,
  items,
}: ShuffleDialogProps) {
  const router = useRouter()
  const [displayedItem, setDisplayedItem] = useState<ListMediaItem | null>(null)
  const [hasRevealed, setHasRevealed] = useState(false)
  const [posterPulse, setPosterPulse] = useState(false)
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isAnimating = isOpen && items.length > 0 && !hasRevealed

  const clearTimers = useCallback(() => {
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current)
      animationTimeoutRef.current = null
    }

    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current)
      startTimeoutRef.current = null
    }

    if (pulseTimeoutRef.current) {
      clearTimeout(pulseTimeoutRef.current)
      pulseTimeoutRef.current = null
    }
  }, [])

  const getRandomItem = useCallback(() => {
    if (items.length === 0) {
      return null
    }

    const randomIndex = Math.floor(Math.random() * items.length)
    return items[randomIndex] ?? null
  }, [items])

  const triggerPosterPulse = useCallback(() => {
    setPosterPulse(false)

    pulseTimeoutRef.current = setTimeout(() => {
      setPosterPulse(true)
      pulseTimeoutRef.current = setTimeout(() => {
        setPosterPulse(false)
      }, 180)
    }, 0)
  }, [])

  const runAnimation = useCallback(() => {
    if (items.length === 0) {
      setDisplayedItem(null)
      setHasRevealed(false)
      return
    }

    setHasRevealed(false)

    const targetItem = getRandomItem()
    if (!targetItem) {
      return
    }

    if (items.length === 1) {
      setDisplayedItem(targetItem)
      setHasRevealed(true)
      return
    }

    const startTime = Date.now()
    let currentInterval = MIN_INTERVAL_MS

    const cycle = () => {
      const elapsed = Date.now() - startTime

      if (elapsed >= ANIMATION_DURATION_MS) {
        setDisplayedItem(targetItem)
        setHasRevealed(true)
        setPosterPulse(true)
        pulseTimeoutRef.current = setTimeout(() => {
          setPosterPulse(false)
        }, 220)
        return
      }

      const nextItem = getRandomItem()
      if (nextItem) {
        setDisplayedItem(nextItem)
        triggerPosterPulse()
      }

      const progress = elapsed / ANIMATION_DURATION_MS
      currentInterval =
        MIN_INTERVAL_MS +
        (MAX_INTERVAL_MS - MIN_INTERVAL_MS) * Math.pow(progress, 2)

      animationTimeoutRef.current = setTimeout(cycle, currentInterval)
    }

    cycle()
  }, [getRandomItem, items.length, triggerPosterPulse])

  useEffect(() => {
    if (!isOpen) {
      clearTimers()
      return
    }

    startTimeoutRef.current = setTimeout(() => {
      setDisplayedItem(null)
      setHasRevealed(false)
      setPosterPulse(false)

      if (items.length === 0) {
        return
      }

      runAnimation()
    }, START_DELAY_MS)

    return clearTimers
  }, [clearTimers, isOpen, items.length, runAnimation])

  useEffect(() => clearTimers, [clearTimers])

  const displayedTitle = displayedItem
    ? displayedItem.title || displayedItem.name || "Unknown Title"
    : ""

  const posterUrl = useMemo(() => {
    if (!displayedItem?.poster_path) {
      return null
    }

    return buildImageUrl(displayedItem.poster_path, "w500")
  }, [displayedItem])

  const handleSpinAgain = useCallback(() => {
    clearTimers()
    setPosterPulse(false)
    runAnimation()
  }, [clearTimers, runAnimation])

  const handleViewDetails = useCallback(() => {
    if (!displayedItem) {
      return
    }

    onClose()
    router.push(getMediaUrl(displayedItem.media_type, displayedItem.id))
  }, [displayedItem, onClose, router])

  return (
    <BaseMediaModal
      isOpen={isOpen}
      onClose={onClose}
      title="Shuffle"
      maxWidth="sm:max-w-lg"
    >
      <div className="flex flex-col gap-6">
        <div className="flex justify-center">
          <div
            data-testid="shuffle-poster-frame"
            className={[
              "relative w-full max-w-[240px] overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 shadow-[0_18px_50px_rgba(0,0,0,0.45)] transition duration-200",
              posterPulse ? "scale-[1.03] opacity-95" : "scale-100 opacity-100",
            ].join(" ")}
          >
            <div className="aspect-[2/3] w-full">
              {displayedItem ? (
                <ImageWithFallback
                  src={posterUrl}
                  alt={displayedTitle}
                  fallbackText="No image"
                  className="bg-neutral-900 text-neutral-500"
                  imageClassName="group-hover:scale-100"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_55%),linear-gradient(180deg,_rgba(26,26,26,1)_0%,_rgba(12,12,12,1)_100%)] text-neutral-400">
                  <HugeiconsIcon icon={ShuffleIcon} className="size-12" />
                  <span className="text-sm font-medium tracking-[0.2em] uppercase">
                    Shuffling...
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="min-h-16 text-center">
          {displayedItem && hasRevealed ? (
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                {displayedTitle}
              </h2>
              {(displayedItem.vote_average ?? 0) > 0 ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-200">
                  <HugeiconsIcon
                    icon={StarIcon}
                    className="size-4 fill-amber-400 text-amber-400"
                  />
                  <span>{displayedItem.vote_average?.toFixed(1)}</span>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium tracking-[0.22em] text-neutral-500 uppercase">
                Shuffle Pick
              </p>
              <p className="text-base text-neutral-300">
                Let the list choose for you.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          {hasRevealed ? (
            <Button className="flex-1" size="lg" onClick={handleViewDetails}>
              View details
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="lg"
            className={hasRevealed ? "flex-1" : "w-full"}
            onClick={handleSpinAgain}
            disabled={isAnimating || items.length === 0}
            data-testid="shuffle-spin-button"
          >
            <HugeiconsIcon icon={ShuffleIcon} className="size-4" />
            {hasRevealed ? "Spin again" : "Shuffling..."}
          </Button>
        </div>
      </div>
    </BaseMediaModal>
  )
}

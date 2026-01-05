"use client"

import { useCallback, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

interface TrailerModalProps {
  /** YouTube video key */
  videoKey: string | null
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback when the modal should close */
  onClose: () => void
  /** Optional title for accessibility */
  title?: string
}

/**
 * TrailerModal Component
 * A reusable modal for playing YouTube trailers
 * Opens as a fullscreen overlay with an embedded YouTube player
 */
export function TrailerModal({
  videoKey,
  isOpen,
  onClose,
  title = "Watch Trailer",
}: TrailerModalProps) {
  // Handle escape key to close modal
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    },
    [onClose],
  )

  // Add/remove event listeners
  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown)
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden"
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [isOpen, handleKeyDown])

  // Don't render if not open or no video key
  if (!isOpen || !videoKey) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div className="relative z-10 w-full max-w-5xl px-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-4 flex items-center gap-2 text-white/70 transition-colors hover:text-white"
          aria-label="Close trailer"
        >
          <span className="text-sm font-medium">Close</span>
          <HugeiconsIcon icon={Cancel01Icon} className="size-6" />
        </button>

        {/* Video Container - 16:9 aspect ratio */}
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl">
          <iframe
            src={`https://www.youtube.com/embed/${videoKey}?autoplay=1&rel=0&modestbranding=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>

        {/* Title */}
        {title && (
          <p className="mt-4 text-center text-sm text-white/60">{title}</p>
        )}
      </div>
    </div>
  )
}

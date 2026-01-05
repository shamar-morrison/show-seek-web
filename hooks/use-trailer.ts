"use client"

import { fetchTrailerKey } from "@/app/actions"
import { useState } from "react"
import { toast } from "sonner"

interface ActiveTrailer {
  key: string
  title: string
}

/**
 * useTrailer Hook
 * Centralizes trailer fetching and modal state management.
 * Eliminates duplicate trailer logic across components.
 */
export function useTrailer() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTrailer, setActiveTrailer] = useState<ActiveTrailer | null>(null)
  const [loadingMediaId, setLoadingMediaId] = useState<number | null>(null)

  const watchTrailer = async (
    mediaId: number,
    mediaType: "movie" | "tv",
    title: string,
  ) => {
    setLoadingMediaId(mediaId)
    try {
      const key = await fetchTrailerKey(mediaId, mediaType)
      if (key) {
        setActiveTrailer({ key, title })
        setIsOpen(true)
      } else {
        toast.error(`No trailer available for ${title}`)
      }
    } catch (error) {
      console.error("Error fetching trailer:", error)
      toast.error("Failed to load trailer")
    } finally {
      setLoadingMediaId(null)
    }
  }

  const closeTrailer = () => {
    setIsOpen(false)
    setActiveTrailer(null)
  }

  return {
    isOpen,
    activeTrailer,
    loadingMediaId,
    watchTrailer,
    closeTrailer,
  }
}

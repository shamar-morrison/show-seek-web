"use client"

import { useCallback } from "react"
import { toast } from "sonner"

import type { FavoriteEpisode } from "@/types/favorite-episode"
import { buildFavoriteEpisodePayload } from "@/types/favorite-episode"

interface EpisodeActionEpisode {
  episode_number: number
  name: string
  season_number: number
}

type RequireAuth = (
  action: () => void | Promise<void>,
  message?: string,
) => void

interface UseEpisodeActionsOptions {
  episode: EpisodeActionEpisode
  favoriteActionLoading: boolean
  isFavorited: boolean
  openNotes: () => void
  requireAuth: RequireAuth
  toggleEpisode: (variables: {
    episode: Omit<FavoriteEpisode, "addedAt">
    isFavorited: boolean
  }) => Promise<void>
  tvShowId: number
  tvShowName: string
  tvShowPosterPath: string | null
}

export function useEpisodeActions({
  episode,
  favoriteActionLoading,
  isFavorited,
  openNotes,
  requireAuth,
  toggleEpisode,
  tvShowId,
  tvShowName,
  tvShowPosterPath,
}: UseEpisodeActionsOptions) {
  const handleToggleFavorite = useCallback(async () => {
    if (favoriteActionLoading) return

    await toggleEpisode({
      isFavorited,
      episode: buildFavoriteEpisodePayload({
        tvShowId,
        episode,
        showName: tvShowName,
        posterPath: tvShowPosterPath,
      }),
    })
  }, [
    episode,
    favoriteActionLoading,
    isFavorited,
    toggleEpisode,
    tvShowId,
    tvShowName,
    tvShowPosterPath,
  ])

  const handleFavoriteClick = useCallback(() => {
    requireAuth(async () => {
      try {
        await handleToggleFavorite()
        toast.success(
          isFavorited
            ? "Removed from favorite episodes"
            : "Added to favorite episodes",
        )
      } catch (error) {
        console.error("Failed to toggle favorite episode:", error)
        toast.error(
          isFavorited
            ? "Failed to remove from favorite episodes"
            : "Failed to add to favorite episodes",
        )
      }
    }, "Sign in to favorite episodes")
  }, [handleToggleFavorite, isFavorited, requireAuth])

  const openNotesModal = useCallback(() => {
    requireAuth(openNotes, "Sign in to add personal notes")
  }, [openNotes, requireAuth])

  return {
    favoriteActionLoading,
    handleFavoriteClick,
    handleToggleFavorite,
    openNotesModal,
  }
}

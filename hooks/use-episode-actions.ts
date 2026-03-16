"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import { toast } from "sonner"

import { showActionableSuccessToast } from "@/lib/actionable-toast"
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

async function runFavoriteEpisodeToggleWithToast({
  episode,
  isFavoriteActionLoading,
  nextIsFavorited,
  toggleEpisode,
}: {
  episode: Omit<FavoriteEpisode, "addedAt">
  isFavoriteActionLoading: () => boolean
  nextIsFavorited: boolean
  toggleEpisode: UseEpisodeActionsOptions["toggleEpisode"]
}) {
  if (isFavoriteActionLoading()) return

  await toggleEpisode({
    isFavorited: nextIsFavorited,
    episode,
  })

  const message = nextIsFavorited
    ? "Removed from favorite episodes"
    : "Added to favorite episodes"

  showActionableSuccessToast(message, {
    action: {
      label: "Undo",
      onClick: () =>
        runFavoriteEpisodeToggleWithToast({
          episode,
          isFavoriteActionLoading,
          nextIsFavorited: !nextIsFavorited,
          toggleEpisode,
        }),
      errorMessage: nextIsFavorited
        ? "Failed to restore favorite episode"
        : "Failed to remove favorite episode",
      logMessage: "Failed to undo favorite episode toggle:",
    },
  })
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
  const favoriteActionLoadingRef = useRef(favoriteActionLoading)

  useEffect(() => {
    favoriteActionLoadingRef.current = favoriteActionLoading
  }, [favoriteActionLoading])

  const isFavoriteActionLoading = useCallback(
    () => favoriteActionLoadingRef.current,
    [],
  )

  const favoriteEpisodePayload = useMemo(
    () =>
      buildFavoriteEpisodePayload({
        tvShowId,
        episode: {
          season_number: episode.season_number,
          episode_number: episode.episode_number,
          name: episode.name,
        },
        showName: tvShowName,
        posterPath: tvShowPosterPath,
      }),
    [
      tvShowId,
      episode.season_number,
      episode.episode_number,
      episode.name,
      tvShowName,
      tvShowPosterPath,
    ],
  )

  const handleToggleFavorite = useCallback(async () => {
    if (favoriteActionLoading) return

    await toggleEpisode({
      isFavorited,
      episode: favoriteEpisodePayload,
    })
  }, [
    favoriteActionLoading,
    favoriteEpisodePayload,
    isFavorited,
    toggleEpisode,
  ])

  const runFavoriteToggleWithToast = useCallback(
    (nextIsFavorited: boolean) =>
      runFavoriteEpisodeToggleWithToast({
        episode: favoriteEpisodePayload,
        isFavoriteActionLoading,
        nextIsFavorited,
        toggleEpisode,
      }),
    [favoriteEpisodePayload, isFavoriteActionLoading, toggleEpisode],
  )

  const handleFavoriteClick = useCallback(() => {
    requireAuth(async () => {
      try {
        await runFavoriteToggleWithToast(isFavorited)
      } catch (error) {
        console.error("Failed to toggle favorite episode:", error)
        toast.error(
          isFavorited
            ? "Failed to remove from favorite episodes"
            : "Failed to add to favorite episodes",
        )
      }
    }, "Sign in to favorite episodes")
  }, [isFavorited, requireAuth, runFavoriteToggleWithToast])

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

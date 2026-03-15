"use client"

import { useAuth } from "@/context/auth-context"
import {
  addFavoriteEpisode,
  fetchFavoriteEpisodes,
  removeFavoriteEpisode,
} from "@/lib/firebase/favorite-episodes"
import { queryCacheProfiles } from "@/lib/react-query/query-options"
import {
  queryKeys,
  UNAUTHENTICATED_USER_ID,
} from "@/lib/react-query/query-keys"
import type { FavoriteEpisode } from "@/types/favorite-episode"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

function useFavoriteEpisodesRead(userId: string | null) {
  const favoriteEpisodesQueryKey = queryKeys.firestore.favoriteEpisodes(
    userId ?? UNAUTHENTICATED_USER_ID,
  )

  const query = useQuery({
    ...queryCacheProfiles.profile,
    queryKey: favoriteEpisodesQueryKey,
    queryFn: async () => {
      if (!userId) return []
      return fetchFavoriteEpisodes(userId)
    },
    enabled: !!userId,
  })

  return {
    favoriteEpisodesQueryKey,
    ...query,
  }
}

interface ToggleFavoriteEpisodeVariables {
  episode: Omit<FavoriteEpisode, "addedAt">
  isFavorited: boolean
}

export function useFavoriteEpisodes() {
  const { user, loading: authLoading } = useAuth()
  const userId = user && !user.isAnonymous ? user.uid : null
  const { data = [], isLoading, error } = useFavoriteEpisodesRead(userId)

  return {
    episodes: data,
    count: data.length,
    loading: authLoading || (!!userId && isLoading),
    error: (error as Error | null) ?? null,
  }
}

export function useIsEpisodeFavorited(
  tvShowId: number,
  seasonNumber: number,
  episodeNumber: number,
) {
  const { user, loading: authLoading } = useAuth()
  const userId = user && !user.isAnonymous ? user.uid : null
  const { data = [], isLoading } = useFavoriteEpisodesRead(userId)

  return {
    isFavorited: data.some(
      (episode) =>
        episode.tvShowId === tvShowId &&
        episode.seasonNumber === seasonNumber &&
        episode.episodeNumber === episodeNumber,
    ),
    loading: authLoading || (!!userId && isLoading),
  }
}

export function useToggleFavoriteEpisode() {
  const { user } = useAuth()
  const userId = user && !user.isAnonymous ? user.uid : null
  const queryClient = useQueryClient()
  const favoriteEpisodesQueryKey = userId
    ? queryKeys.firestore.favoriteEpisodes(userId)
    : null

  const mutation = useMutation({
    mutationFn: async ({
      episode,
      isFavorited,
    }: ToggleFavoriteEpisodeVariables) => {
      if (!userId) {
        throw new Error("Please sign in to add favorites")
      }

      if (isFavorited) {
        await removeFavoriteEpisode(userId, episode.id)
        return
      }

      await addFavoriteEpisode(userId, episode)
    },
    onMutate: async ({ episode, isFavorited }) => {
      if (!favoriteEpisodesQueryKey) {
        return {
          previousEpisodes: undefined as FavoriteEpisode[] | undefined,
        }
      }

      await queryClient.cancelQueries({ queryKey: favoriteEpisodesQueryKey })
      const previousEpisodes = queryClient.getQueryData<FavoriteEpisode[]>(
        favoriteEpisodesQueryKey,
      )

      if (isFavorited) {
        queryClient.setQueryData(
          favoriteEpisodesQueryKey,
          (previousEpisodes ?? []).filter(
            (favoriteEpisode) => favoriteEpisode.id !== episode.id,
          ),
        )
      } else {
        const optimisticEpisode: FavoriteEpisode = {
          ...episode,
          addedAt: Date.now(),
        }

        const nextEpisodes = [...(previousEpisodes ?? [])].filter(
          (favoriteEpisode) => favoriteEpisode.id !== optimisticEpisode.id,
        )
        nextEpisodes.unshift(optimisticEpisode)
        queryClient.setQueryData(favoriteEpisodesQueryKey, nextEpisodes)
      }

      return { previousEpisodes }
    },
    onError: (_error, _variables, context) => {
      if (!favoriteEpisodesQueryKey) return
      if (context !== undefined) {
        queryClient.setQueryData(
          favoriteEpisodesQueryKey,
          context.previousEpisodes,
        )
      }
    },
    onSettled: () => {
      if (!favoriteEpisodesQueryKey) return
      queryClient.invalidateQueries({ queryKey: favoriteEpisodesQueryKey })
    },
  })

  return {
    toggleEpisode: mutation.mutateAsync,
    isToggling: mutation.isPending,
    isAuthenticated: !!userId,
  }
}

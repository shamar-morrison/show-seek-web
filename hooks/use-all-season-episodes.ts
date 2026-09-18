"use client"

import { fetchSeasonEpisodes, type SeasonEpisodeData } from "@/app/actions"
import { queryCacheProfiles } from "@/lib/react-query/query-options"
import { queryKeys } from "@/lib/react-query/query-keys"
import { createRateLimitedQueryFn } from "@/lib/react-query/rate-limited-query"
import type { TMDBSeason } from "@/types/tmdb"
import { useQueries } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useState } from "react"

/**
 * Eagerly (but only after first paint) fetch every regular season's episode
 * list for the show-wide watch button.
 *
 * The TV detail page is a server component; fetching all seasons there would
 * add one TMDB round-trip per season to the critical path and delay TTFB/LCP.
 * Instead the fan-out starts on the client once the browser is idle, so hero
 * artwork wins the bandwidth race. Uses the same query keys as
 * `useSeasonEpisodes` to share the React Query cache with season pages, and the
 * rate limiter keeps the TMDB request burst under control.
 */
export function useAllSeasonEpisodes(
  tvShowId: number,
  seasons: TMDBSeason[],
  enabled = true,
) {
  const regularSeasons = useMemo(
    () => (seasons ?? []).filter((season) => season.season_number > 0),
    [seasons],
  )

  // Readiness is keyed to the current request so that switching shows or the
  // regular-season set re-applies the post-paint deferral instead of reusing a
  // flag that was set for a previous request.
  const requestKey = `${tvShowId}:${regularSeasons
    .map((season) => season.season_number)
    .join(",")}`
  const [readyKey, setReadyKey] = useState<string | null>(null)
  const isReady = readyKey === requestKey

  useEffect(() => {
    if (!enabled || regularSeasons.length === 0) return
    if (readyKey === requestKey) return

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(
        () => setReadyKey(requestKey),
        { timeout: 2000 },
      )
      return () => window.cancelIdleCallback(idleId)
    }

    const timer = setTimeout(() => setReadyKey(requestKey), 200)
    return () => clearTimeout(timer)
  }, [enabled, requestKey, regularSeasons.length, readyKey])

  const results = useQueries({
    queries: regularSeasons.map((season) => ({
      ...queryCacheProfiles.profile,
      queryKey: queryKeys.tmdb.seasonEpisodes(tvShowId, season.season_number),
      queryFn: createRateLimitedQueryFn(() =>
        fetchSeasonEpisodes(tvShowId, season.season_number),
      ),
      enabled: enabled && isReady,
    })),
  })

  const episodesBySeason = useMemo(() => {
    const map = new Map<number, SeasonEpisodeData[]>()
    regularSeasons.forEach((season, index) => {
      map.set(season.season_number, results[index]?.data ?? [])
    })
    return map
  }, [regularSeasons, results])

  const isLoading = regularSeasons.some(
    (_season, index) => results[index]?.isLoading ?? false,
  )
  const hasFetchedAll = regularSeasons.every(
    (_season, index) => results[index]?.isFetched ?? false,
  )

  // A failed season must not be mistaken for a season that legitimately has no
  // episodes, so surface an aggregate error and a retry across failed queries.
  const firstError = results.find((result) => result?.isError)?.error ?? null
  const error = (firstError as Error | null) ?? null
  const isError = error !== null

  const retry = useCallback(() => {
    results.forEach((result) => {
      if (result?.isError) {
        void result.refetch()
      }
    })
  }, [results])

  return {
    episodesBySeason,
    isLoading:
      enabled && regularSeasons.length > 0 && (!isReady || isLoading),
    hasFetchedAll,
    isError,
    error,
    retry,
  }
}

"use client"

import { fetchSeasonEpisodes, fetchTVShowDetails } from "@/app/actions"
import { type WatchProgressItem } from "@/hooks/use-episode-tracking"
import { parseEpisodeKey } from "@/lib/episode-utils"
import { useCallback, useEffect, useRef, useState } from "react"

/** Concurrency limit for TMDB fetches */
const BATCH_CONCURRENCY = 5

/** Cache duration in milliseconds (5 minutes like mobile) */
const CACHE_DURATION_MS = 5 * 60 * 1000

/** Cache key prefix for sessionStorage */
const CACHE_KEY_PREFIX = "watch_progress_enrichment_"

interface CachedEnrichment {
  timestamp: number
  watchedKeysHash: string
  data: Partial<WatchProgressItem>
}

/**
 * Simple hash function for watched keys to detect changes
 */
function hashWatchedKeys(keys: Set<string>): string {
  return Array.from(keys).sort().join(",")
}

/**
 * Get the highest season number from watched episodes
 */
function getMaxWatchedSeason(watchedKeys: Set<string>): number {
  let maxSeason = 1
  for (const key of watchedKeys) {
    const parsed = parseEpisodeKey(key)
    if (parsed && parsed.season > 0 && parsed.season > maxSeason) {
      maxSeason = parsed.season
    }
  }
  return maxSeason
}

/**
 * Compute the next episode to watch based on watched episodes and season data.
 */
function computeNextEpisodeFromWatched(
  watchedKeys: Set<string>,
  seasonsData: Map<
    number,
    { episode_number: number; name: string; air_date: string | null }[]
  >,
  seasons: { season_number: number }[],
): {
  season: number
  episode: number
  title: string
  airDate: string | null
} | null {
  const today = new Date()

  // Sort seasons by number (excluding specials - season 0)
  const sortedSeasons = [...seasons]
    .filter((s) => s.season_number > 0)
    .sort((a, b) => a.season_number - b.season_number)

  for (const season of sortedSeasons) {
    const episodes = seasonsData.get(season.season_number)
    if (!episodes) continue

    const sortedEpisodes = [...episodes].sort(
      (a, b) => a.episode_number - b.episode_number,
    )

    for (const ep of sortedEpisodes) {
      const key = `${season.season_number}_${ep.episode_number}`
      const isWatched = watchedKeys.has(key)

      if (!isWatched) {
        const airDate = ep.air_date ? new Date(ep.air_date) : null
        if (airDate && airDate <= today) {
          return {
            season: season.season_number,
            episode: ep.episode_number,
            title: ep.name,
            airDate: ep.air_date,
          }
        }
      }
    }
  }

  return null
}

/**
 * Get cached enrichment data from sessionStorage
 */
function getCachedEnrichment(
  tvShowId: number,
  currentWatchedKeysHash: string,
): Partial<WatchProgressItem> | null {
  if (typeof window === "undefined") return null

  try {
    const cached = sessionStorage.getItem(`${CACHE_KEY_PREFIX}${tvShowId}`)
    if (!cached) return null

    const parsed: CachedEnrichment = JSON.parse(cached)
    const now = Date.now()

    // Check if cache is still valid (not expired and watched keys unchanged)
    if (
      now - parsed.timestamp < CACHE_DURATION_MS &&
      parsed.watchedKeysHash === currentWatchedKeysHash
    ) {
      return parsed.data
    }

    // Cache expired or watched keys changed - remove it
    sessionStorage.removeItem(`${CACHE_KEY_PREFIX}${tvShowId}`)
    return null
  } catch {
    return null
  }
}

/**
 * Save enrichment data to sessionStorage cache
 */
function setCachedEnrichment(
  tvShowId: number,
  watchedKeysHash: string,
  data: Partial<WatchProgressItem>,
): void {
  if (typeof window === "undefined") return

  try {
    const cached: CachedEnrichment = {
      timestamp: Date.now(),
      watchedKeysHash,
      data,
    }
    sessionStorage.setItem(
      `${CACHE_KEY_PREFIX}${tvShowId}`,
      JSON.stringify(cached),
    )
  } catch {
    // Ignore storage errors (e.g., quota exceeded)
  }
}

/**
 * Hook that enriches watch progress data by fetching fresh TMDB data.
 * Optimized to:
 * 1. Fetch only current season + next season (not all seasons)
 * 2. Use 5-minute sessionStorage cache
 * 3. Invalidate cache when watched episodes change
 */
export function useWatchProgressEnrichment(
  initialProgress: WatchProgressItem[],
  watchedEpisodesByShow: Map<number, Set<string>>,
) {
  const [enrichedProgress, setEnrichedProgress] =
    useState<WatchProgressItem[]>(initialProgress)
  const [isEnriching, setIsEnriching] = useState(false)
  const enrichedShowsRef = useRef<Set<number>>(new Set())
  const prevIncomingIdsRef = useRef<Set<number>>(new Set())

  // Reset when initial data changes significantly (track with ref to avoid dependency cycle)
  useEffect(() => {
    const incomingIds = new Set(initialProgress.map((p) => p.tvShowId))
    const prevIds = prevIncomingIdsRef.current

    const idsMatch =
      incomingIds.size === prevIds.size &&
      [...incomingIds].every((id) => prevIds.has(id))

    if (!idsMatch) {
      // Clean up enriched cache for removed shows
      for (const id of enrichedShowsRef.current) {
        if (!incomingIds.has(id)) {
          enrichedShowsRef.current.delete(id)
        }
      }
      setEnrichedProgress(initialProgress)
      prevIncomingIdsRef.current = incomingIds
    }
  }, [initialProgress])

  const enrichItems = useCallback(async () => {
    if (initialProgress.length === 0) return

    // Find items that need enrichment
    const itemsToEnrich = initialProgress.filter(
      (p) => !enrichedShowsRef.current.has(p.tvShowId),
    )

    if (itemsToEnrich.length === 0) return

    setIsEnriching(true)

    try {
      const queue = [...itemsToEnrich]
      const enrichedUpdates: Map<number, Partial<WatchProgressItem>> = new Map()

      while (queue.length > 0) {
        const batch = queue.splice(0, BATCH_CONCURRENCY)

        await Promise.all(
          batch.map(async (item) => {
            try {
              const watchedKeys =
                watchedEpisodesByShow.get(item.tvShowId) || new Set()
              const watchedKeysHash = hashWatchedKeys(watchedKeys)

              // Check cache first
              const cached = getCachedEnrichment(item.tvShowId, watchedKeysHash)
              if (cached) {
                enrichedUpdates.set(item.tvShowId, cached)
                enrichedShowsRef.current.add(item.tvShowId)
                return
              }

              // Fetch TV show details
              const details = await fetchTVShowDetails(item.tvShowId)
              if (!details) return

              // OPTIMIZATION: Only fetch current season + next season
              const maxWatchedSeason = getMaxWatchedSeason(watchedKeys)
              const seasonsToFetch = [
                maxWatchedSeason,
                maxWatchedSeason + 1,
              ].filter((s) =>
                details.seasons.some((ds) => ds.season_number === s),
              )

              // If no seasons found, fall back to last 2 aired seasons
              if (seasonsToFetch.length === 0) {
                const airedSeasons = details.seasons
                  .filter((s) => s.season_number > 0 && s.air_date)
                  .sort((a, b) => b.season_number - a.season_number)
                  .slice(0, 2)
                  .map((s) => s.season_number)
                seasonsToFetch.push(...airedSeasons)
              }

              const seasonsData = new Map<
                number,
                {
                  episode_number: number
                  name: string
                  air_date: string | null
                }[]
              >()

              // Fetch only the targeted seasons
              await Promise.all(
                seasonsToFetch.map(async (seasonNum) => {
                  const episodes = await fetchSeasonEpisodes(
                    item.tvShowId,
                    seasonNum,
                  )
                  if (episodes && episodes.length > 0) {
                    seasonsData.set(
                      seasonNum,
                      episodes.map((ep) => ({
                        episode_number: ep.episode_number,
                        name: ep.name,
                        air_date: ep.air_date,
                      })),
                    )
                  }
                }),
              )

              // Compute next episode from the fetched seasons
              const nextEpisode = computeNextEpisodeFromWatched(
                watchedKeys,
                seasonsData,
                details.seasons,
              )

              // Calculate values
              const totalEpisodes = details.totalEpisodes
              const avgRuntime = details.avgRuntime
              const watchedCount = watchedKeys.size
              const percentage =
                totalEpisodes > 0
                  ? Math.round((watchedCount / totalEpisodes) * 100)
                  : 0

              // Time remaining: ALL remaining episodes (total - watched), not just fetched seasons
              // This matches mobile app behavior
              const remainingEpisodes = Math.max(
                0,
                totalEpisodes - watchedCount,
              )
              const timeRemaining = remainingEpisodes * avgRuntime

              const enrichmentData: Partial<WatchProgressItem> = {
                totalEpisodes,
                avgRuntime,
                watchedCount,
                percentage,
                timeRemaining,
                nextEpisode,
              }

              // Cache the result
              setCachedEnrichment(
                item.tvShowId,
                watchedKeysHash,
                enrichmentData,
              )

              enrichedUpdates.set(item.tvShowId, enrichmentData)
              enrichedShowsRef.current.add(item.tvShowId)
            } catch (error) {
              console.error(`Failed to enrich show ${item.tvShowId}:`, error)
            }
          }),
        )
      }

      // Apply all updates at once
      if (enrichedUpdates.size > 0) {
        setEnrichedProgress((current) =>
          current.map((p) => {
            const update = enrichedUpdates.get(p.tvShowId)
            if (update) {
              return { ...p, ...update }
            }
            return p
          }),
        )
      }
    } finally {
      setIsEnriching(false)
    }
  }, [initialProgress, watchedEpisodesByShow])

  // Trigger enrichment when initialProgress changes
  useEffect(() => {
    enrichItems()
  }, [enrichItems])

  return {
    enrichedProgress,
    isEnriching,
  }
}

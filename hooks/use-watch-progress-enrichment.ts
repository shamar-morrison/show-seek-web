"use client"

import { fetchSeasonEpisodes, fetchTVShowDetails } from "@/app/actions"
import { type WatchProgressItem } from "@/hooks/use-episode-tracking"
import { useCallback, useEffect, useRef, useState } from "react"

/** Concurrency limit for TMDB fetches */
const BATCH_CONCURRENCY = 5

/**
 * Parse episode key (e.g., "1_3") to season and episode numbers
 */
function parseEpisodeKey(
  key: string,
): { season: number; episode: number } | null {
  const match = key.match(/^(\d+)_(\d+)$/)
  if (!match) return null
  return {
    season: parseInt(match[1], 10),
    episode: parseInt(match[2], 10),
  }
}

/**
 * Compute the next episode to watch based on watched episodes and season data.
 * Finds the first unwatched aired episode in order: all episodes of season 1, then season 2, etc.
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

    // Sort episodes by number
    const sortedEpisodes = [...episodes].sort(
      (a, b) => a.episode_number - b.episode_number,
    )

    for (const ep of sortedEpisodes) {
      const key = `${season.season_number}_${ep.episode_number}`
      const isWatched = watchedKeys.has(key)

      if (!isWatched) {
        // Check if aired
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

  // All aired episodes watched - caught up!
  return null
}

/**
 * Hook that enriches watch progress data by fetching fresh TMDB data.
 * Processes items in batches to avoid overwhelming the API.
 */
export function useWatchProgressEnrichment(
  initialProgress: WatchProgressItem[],
  watchedEpisodesByShow: Map<number, Set<string>>,
) {
  const [enrichedProgress, setEnrichedProgress] =
    useState<WatchProgressItem[]>(initialProgress)
  const [isEnriching, setIsEnriching] = useState(false)
  const enrichedShowsRef = useRef<Set<number>>(new Set())

  // Reset when initial data changes significantly (e.g., on re-login)
  useEffect(() => {
    const incomingIds = new Set(initialProgress.map((p) => p.tvShowId))
    const currentIds = new Set(enrichedProgress.map((p) => p.tvShowId))

    // Check if the set of shows changed
    const idsMatch =
      incomingIds.size === currentIds.size &&
      [...incomingIds].every((id) => currentIds.has(id))

    if (!idsMatch) {
      // Reset enriched cache for removed shows
      for (const id of enrichedShowsRef.current) {
        if (!incomingIds.has(id)) {
          enrichedShowsRef.current.delete(id)
        }
      }
      setEnrichedProgress(initialProgress)
    }
  }, [initialProgress, enrichedProgress])

  const enrichItems = useCallback(async () => {
    if (initialProgress.length === 0) return

    // Find items that need enrichment (not already enriched this session)
    const itemsToEnrich = initialProgress.filter(
      (p) => !enrichedShowsRef.current.has(p.tvShowId),
    )

    if (itemsToEnrich.length === 0) return

    setIsEnriching(true)

    try {
      // Process in batches with concurrency limit
      const queue = [...itemsToEnrich]
      const enrichedUpdates: Map<number, Partial<WatchProgressItem>> = new Map()

      while (queue.length > 0) {
        const batch = queue.splice(0, BATCH_CONCURRENCY)

        await Promise.all(
          batch.map(async (item) => {
            try {
              const details = await fetchTVShowDetails(item.tvShowId)
              if (!details) return

              // Determine which seasons have watched episodes
              const watchedKeys =
                watchedEpisodesByShow.get(item.tvShowId) || new Set()
              const seasonsWithWatched = new Set<number>()
              for (const key of watchedKeys) {
                const parsed = parseEpisodeKey(key)
                if (parsed && parsed.season > 0) {
                  seasonsWithWatched.add(parsed.season)
                }
              }

              // Fetch all aired seasons that we care about
              // Include all seasons to find the true next episode
              const seasonNumbers = details.seasons
                .filter((s) => s.season_number > 0)
                .map((s) => s.season_number)

              const seasonsData = new Map<
                number,
                {
                  episode_number: number
                  name: string
                  air_date: string | null
                }[]
              >()

              // Fetch season details in parallel (limited by outer batch)
              await Promise.all(
                seasonNumbers.map(async (seasonNum) => {
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

              // Compute next episode
              const nextEpisode = computeNextEpisodeFromWatched(
                watchedKeys,
                seasonsData,
                details.seasons,
              )

              // Count total AIRED episodes (for time remaining calculation)
              const today = new Date()
              let totalAiredEpisodes = 0
              for (const episodes of seasonsData.values()) {
                for (const ep of episodes) {
                  if (ep.air_date && new Date(ep.air_date) <= today) {
                    totalAiredEpisodes++
                  }
                }
              }

              // Use TOTAL episodes for percentage (like mobile app)
              // Use AIRED episodes for time remaining
              const totalEpisodes = details.totalEpisodes
              const avgRuntime = details.avgRuntime
              const watchedCount = watchedKeys.size
              const percentage =
                totalEpisodes > 0
                  ? Math.round((watchedCount / totalEpisodes) * 100)
                  : 0
              const remainingAiredEpisodes = Math.max(
                0,
                totalAiredEpisodes - watchedCount,
              )
              const timeRemaining = remainingAiredEpisodes * avgRuntime

              enrichedUpdates.set(item.tvShowId, {
                totalEpisodes,
                avgRuntime,
                watchedCount,
                percentage,
                timeRemaining,
                nextEpisode,
              })

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

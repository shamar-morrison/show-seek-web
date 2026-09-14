"use client"

import { fetchSeasonEpisodes, fetchTVShowDetails } from "@/app/actions"
import { type WatchProgressItem } from "@/hooks/use-episode-tracking"
import { parseEpisodeKey } from "@/lib/episode-utils"
import { isTmdbDateOnOrBeforeToday } from "@/lib/tmdb-date"
import { type NextEpisodeState } from "@/types/episode-tracking"
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
 * Safe status check: returns true for active shows.
 * Defaults to true if status is missing/failed fetch to avoid false 'Ended'.
 */
function isShowStillActive(details: {
  status: string | null
  next_episode_to_air: unknown
}): boolean {
  if (!details.status) return true
  return (
    details.status === "Returning Series" ||
    details.status === "In Production" ||
    Boolean(details.next_episode_to_air)
  )
}

function buildSeasonCounts(
  seasons: Array<{ season_number: number; episode_count: number }>,
): Array<[number, number]> {
  return seasons
    .filter(
      (season) => season.season_number > 0 && (season.episode_count ?? 0) > 0,
    )
    .sort((left, right) => left.season_number - right.season_number)
    .map((season) => [season.season_number, season.episode_count ?? 0])
}

function getEpisodePosition(
  seasonCounts: Array<[number, number]>,
  seasonNumber: number,
  episodeNumber: number,
): number {
  let position = 0
  seasonCounts.forEach(([season, count]) => {
    if (season < seasonNumber) {
      position += count
    }
  })
  const seasonCount = seasonCounts.find(
    ([season]) => season === seasonNumber,
  )?.[1]
  const clampedEpisodeNumber =
    seasonCount !== undefined
      ? Math.min(Math.max(episodeNumber, 0), seasonCount)
      : Math.max(episodeNumber, 0)
  return position + clampedEpisodeNumber
}

function resolveShowLevelLastAiredEpisode(
  lastEpisodeToAir:
    | {
        season_number: number
        episode_number: number
        air_date: string | null
      }
    | null
    | undefined,
  today = new Date(),
): { episodeNumber: number; seasonNumber: number } | null {
  if (
    lastEpisodeToAir &&
    lastEpisodeToAir.season_number > 0 &&
    lastEpisodeToAir.episode_number > 0 &&
    isTmdbDateOnOrBeforeToday(lastEpisodeToAir.air_date, today)
  ) {
    return {
      seasonNumber: lastEpisodeToAir.season_number,
      episodeNumber: lastEpisodeToAir.episode_number,
    }
  }
  return null
}

function getFallbackBoundarySeasonNumber(
  seasons: Array<{
    season_number: number
    episode_count: number
    air_date: string | null
  }>,
  today = new Date(),
): number | null {
  const fallbackSeason = seasons
    .filter(
      (season) =>
        season.season_number > 0 &&
        (season.episode_count ?? 0) > 0 &&
        isTmdbDateOnOrBeforeToday(season.air_date, today),
    )
    .sort((left, right) => right.season_number - left.season_number)[0]
  return fallbackSeason?.season_number ?? null
}

function getLastAiredEpisodeFromSeason(
  episodes: Array<{
    season_number: number
    episode_number: number
    air_date: string | null
  }>,
  today = new Date(),
): { episodeNumber: number; seasonNumber: number } | null {
  const lastAiredEpisode = [...episodes]
    .filter(
      (episode) =>
        episode.season_number > 0 &&
        episode.episode_number > 0 &&
        isTmdbDateOnOrBeforeToday(episode.air_date, today),
    )
    .sort((left, right) => right.episode_number - left.episode_number)[0]
  if (!lastAiredEpisode) return null
  return {
    seasonNumber: lastAiredEpisode.season_number,
    episodeNumber: lastAiredEpisode.episode_number,
  }
}

function resolveLastAiredEpisode(
  details: {
    last_episode_to_air: {
      season_number: number
      episode_number: number
      air_date: string | null
    } | null
    seasons: Array<{
      season_number: number
      episode_count: number
      air_date: string | null
    }>
  },
  today: Date,
  seasonDataByNumber: Map<
    number,
    Array<{
      season_number: number
      episode_number: number
      air_date: string | null
    }>
  >,
): { episodeNumber: number; seasonNumber: number } | null {
  const showLevelLastAiredEpisode = resolveShowLevelLastAiredEpisode(
    details.last_episode_to_air,
    today,
  )
  if (showLevelLastAiredEpisode) {
    return showLevelLastAiredEpisode
  }
  const fallbackBoundarySeasonNumber = getFallbackBoundarySeasonNumber(
    details.seasons,
    today,
  )
  if (fallbackBoundarySeasonNumber === null) {
    return null
  }
  const fallbackSeasonData = seasonDataByNumber.get(
    fallbackBoundarySeasonNumber,
  )
  if (!fallbackSeasonData) {
    return null
  }
  return getLastAiredEpisodeFromSeason(fallbackSeasonData, today)
}

function getNextEpisodeAfter(
  seasonCounts: Array<[number, number]>,
  currentSeason: number,
  currentEpisode: number,
): { episode: number; season: number } | null {
  const currentSeasonIndex = seasonCounts.findIndex(
    ([season]) => season === currentSeason,
  )
  if (currentSeasonIndex >= 0) {
    const [, episodeCount] = seasonCounts[currentSeasonIndex]
    if (currentEpisode < episodeCount) {
      return {
        season: currentSeason,
        episode: currentEpisode + 1,
      }
    }
    for (
      let index = currentSeasonIndex + 1;
      index < seasonCounts.length;
      index += 1
    ) {
      const [season, count] = seasonCounts[index]
      if (count > 0) {
        return {
          season,
          episode: 1,
        }
      }
    }
    return null
  }
  const fallbackSeason = seasonCounts.find(
    ([season, count]) => season > currentSeason && count > 0,
  )
  return fallbackSeason
    ? {
        season: fallbackSeason[0],
        episode: 1,
      }
    : null
}

interface UnwatchedAiredScanResult {
  firstUnwatched: { season: number; episode: number } | null
  unwatchedCount: number
}

function scanUnwatchedAiredEpisodes(
  seasonCounts: Array<[number, number]>,
  lastAiredEpisode: { seasonNumber: number; episodeNumber: number },
  watchedKeys: Set<string>,
): UnwatchedAiredScanResult {
  let firstUnwatched: { season: number; episode: number } | null = null
  let unwatchedCount = 0

  for (const [seasonNumber, count] of seasonCounts) {
    if (seasonNumber > lastAiredEpisode.seasonNumber) break
    const maxEpisode =
      seasonNumber === lastAiredEpisode.seasonNumber
        ? Math.min(count, lastAiredEpisode.episodeNumber)
        : count

    for (let episodeNumber = 1; episodeNumber <= maxEpisode; episodeNumber += 1) {
      const isWatched = watchedKeys.has(`${seasonNumber}_${episodeNumber}`)
      if (!isWatched) {
        if (!firstUnwatched) {
          firstUnwatched = { season: seasonNumber, episode: episodeNumber }
        }
        unwatchedCount += 1
      }
    }
  }

  return { firstUnwatched, unwatchedCount }
}

function getFurthestWatched(
  watchedKeys: Set<string>,
): { season: number; episode: number } {
  let furthest = { season: 1, episode: 0 }
  for (const key of watchedKeys) {
    const parsed = parseEpisodeKey(key)
    if (!parsed || parsed.season <= 0) continue
    if (
      parsed.season > furthest.season ||
      (parsed.season === furthest.season && parsed.episode > furthest.episode)
    ) {
      furthest = parsed
    }
  }
  return furthest
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
    } else {
      setEnrichedProgress((current) => {
        const freshMap = new Map(initialProgress.map((p) => [p.tvShowId, p]))
        return current.map((p) => {
          const fresh = freshMap.get(p.tvShowId)
          if (!fresh) return p
          if (
            p.isHidden === fresh.isHidden &&
            p.lastUpdated === fresh.lastUpdated &&
            p.watchedCount === fresh.watchedCount
          ) {
            return p
          }
          return {
            ...p,
            isHidden: fresh.isHidden,
            lastUpdated: fresh.lastUpdated,
            watchedCount: fresh.watchedCount,
            lastWatchedEpisode: fresh.lastWatchedEpisode,
          }
        })
      })
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

              const today = new Date()
              const seasonCounts = buildSeasonCounts(details.seasons)
              const totalKnownEpisodes = seasonCounts.reduce(
                (sum, [, count]) => sum + count,
                0,
              )
              const furthestWatched = getFurthestWatched(watchedKeys)
              const nextEpisodeNumbers = getNextEpisodeAfter(
                seasonCounts,
                furthestWatched.season,
                furthestWatched.episode,
              )
              const showLevelLastAiredEpisode = resolveShowLevelLastAiredEpisode(
                details.last_episode_to_air,
                today,
              )

              // Build targeted season requests matching mobile
              const requestSeasonNumbers = new Set<number>()
              if (showLevelLastAiredEpisode) {
                const { firstUnwatched } = scanUnwatchedAiredEpisodes(
                  seasonCounts,
                  showLevelLastAiredEpisode,
                  watchedKeys,
                )
                if (firstUnwatched) {
                  requestSeasonNumbers.add(firstUnwatched.season)
                } else if (nextEpisodeNumbers) {
                  requestSeasonNumbers.add(nextEpisodeNumbers.season)
                }
              } else {
                const fallbackBoundarySeasonNumber =
                  getFallbackBoundarySeasonNumber(details.seasons, today)
                if (fallbackBoundarySeasonNumber !== null) {
                  requestSeasonNumbers.add(fallbackBoundarySeasonNumber)
                }
                if (nextEpisodeNumbers) {
                  requestSeasonNumbers.add(nextEpisodeNumbers.season)
                }
              }

              const seasonsToFetch = Array.from(requestSeasonNumbers).slice(
                0,
                2,
              )
              if (seasonsToFetch.length === 0) {
                const fallback = details.seasons
                  .filter((s) => s.season_number > 0 && s.air_date)
                  .sort((a, b) => b.season_number - a.season_number)
                  .slice(0, 2)
                  .map((s) => s.season_number)
                seasonsToFetch.push(...fallback)
              }

              const seasonsData = new Map<
                number,
                {
                  season_number: number
                  episode_number: number
                  name: string
                  air_date: string | null
                }[]
              >()

              // Fetch only targeted seasons
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
                        season_number: seasonNum,
                        episode_number: ep.episode_number,
                        name: ep.name,
                        air_date: ep.air_date,
                      })),
                    )
                  }
                }),
              )

              const lastAiredEpisode = resolveLastAiredEpisode(
                details,
                today,
                seasonsData,
              )

              const totalAiredEpisodes = lastAiredEpisode
                ? getEpisodePosition(
                    seasonCounts,
                    lastAiredEpisode.seasonNumber,
                    lastAiredEpisode.episodeNumber,
                  )
                : 0

              const showStillActive = isShowStillActive(details)
              const showEnded = !showStillActive

              const {
                firstUnwatched: firstUnwatchedAiredEpisode,
                unwatchedCount: remainingAiredEpisodes,
              } = lastAiredEpisode
                ? scanUnwatchedAiredEpisodes(
                    seasonCounts,
                    lastAiredEpisode,
                    watchedKeys,
                  )
                : { firstUnwatched: null, unwatchedCount: 0 }

              const avgRuntime = details.avgRuntime || 45

              const furthestWatchedPosition = getEpisodePosition(
                seasonCounts,
                furthestWatched.season,
                furthestWatched.episode,
              )
              const hasWatchedAhead = furthestWatchedPosition > totalAiredEpisodes

              // Numerator: count of watched episodes (all watched if watched ahead, otherwise actual watched aired episodes)
              const watchedCount = hasWatchedAhead
                ? watchedKeys.size
                : Math.max(0, totalAiredEpisodes - remainingAiredEpisodes)

              // Denominator: always total known episodes (Option A+)
              const percentage =
                totalKnownEpisodes > 0
                  ? Math.min(
                      100,
                      Math.round((watchedCount / totalKnownEpisodes) * 100),
                    )
                  : 0

              // Time remaining: only for unwatched aired episodes
              const timeRemaining =
                remainingAiredEpisodes > 0
                  ? remainingAiredEpisodes * avgRuntime
                  : 0

              // Build nextEpisode matching mobile exactly
              let nextEpisode: NextEpisodeState = null

              if (firstUnwatchedAiredEpisode) {
                const ep = seasonsData
                  .get(firstUnwatchedAiredEpisode.season)
                  ?.find(
                    (e) =>
                      e.episode_number === firstUnwatchedAiredEpisode.episode,
                  )
                nextEpisode = {
                  kind: "unwatched",
                  season: firstUnwatchedAiredEpisode.season,
                  episode: firstUnwatchedAiredEpisode.episode,
                  title:
                    ep?.name ||
                    `Episode ${firstUnwatchedAiredEpisode.episode}`,
                }
              } else if (showStillActive) {
                const nextToAir = details.next_episode_to_air
                const isNextToAirBeyondFurthest =
                  nextToAir &&
                  nextToAir.season_number > 0 &&
                  nextToAir.episode_number > 0 &&
                  (!nextEpisodeNumbers ||
                    nextToAir.season_number > furthestWatched.season ||
                    (nextToAir.season_number === furthestWatched.season &&
                      nextToAir.episode_number > furthestWatched.episode))

                if (isNextToAirBeyondFurthest && nextToAir) {
                  nextEpisode = {
                    kind: "upcoming",
                    season: nextToAir.season_number,
                    episode: nextToAir.episode_number,
                    title:
                      nextToAir.name ||
                      `Episode ${nextToAir.episode_number}`,
                  }
                } else if (nextEpisodeNumbers) {
                  const ep = seasonsData
                    .get(nextEpisodeNumbers.season)
                    ?.find(
                      (e) => e.episode_number === nextEpisodeNumbers.episode,
                    )
                  nextEpisode = {
                    kind: "upcoming",
                    season: nextEpisodeNumbers.season,
                    episode: nextEpisodeNumbers.episode,
                    title:
                      ep?.name ||
                      `Episode ${nextEpisodeNumbers.episode}`,
                  }
                } else {
                  nextEpisode = {
                    kind: "upcoming",
                    season: 0,
                    episode: 0,
                    title: "Caught up!",
                  }
                }
              } else {
                nextEpisode = { kind: "complete" }
              }

              const enrichmentData: Partial<WatchProgressItem> = {
                totalEpisodes: totalKnownEpisodes,
                avgRuntime,
                watchedCount,
                percentage,
                timeRemaining,
                showEnded,
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

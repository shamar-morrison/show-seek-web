"use client"

import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/config"
import { normalizeEpisodeTrackingDoc } from "@/lib/episode-tracking-normalization"
import { computeNextEpisode } from "@/lib/episode-utils"
import type {
  EpisodeTrackingMetadata,
  TVShowEpisodeTracking,
  WatchedEpisode,
} from "@/types/episode-tracking"
import type { SeasonEpisodeInput } from "@/types/episode-tracking-inputs"
import {
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore"

// Inline helper to extract error message
function getFirestoreErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function isNotFoundUpdateError(error: unknown): boolean {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined

  if (typeof code === "string") {
    return code === "not-found" || code === "firestore/not-found"
  }

  const errorMessage = getFirestoreErrorMessage(error)
  return (
    errorMessage.includes("No document to update") ||
    errorMessage.includes("not-found")
  )
}

class EpisodeTrackingService {
  private getCurrentUser() {
    return getFirebaseAuth().currentUser
  }

  /**
   * Get reference to a TV show's episode tracking document
   */
  private getShowTrackingRef(userId: string, tvShowId: number) {
    return doc(
      getFirebaseDb(),
      "users",
      userId,
      "episode_tracking",
      tvShowId.toString(),
    )
  }

  /**
   * Generate composite key for episode
   */
  private getEpisodeKey(seasonNumber: number, episodeNumber: number): string {
    return `${seasonNumber}_${episodeNumber}`
  }

  /**
   * Wrap a Promise with a timeout
   * Rejects with the provided error message if the operation doesn't complete in time
   */
  private withTimeout<T>(
    operation: Promise<T>,
    timeoutMs = 10000,
    errorMessage = "Request timed out",
  ): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    })
    return Promise.race([operation, timeoutPromise]).finally(() => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    })
  }

  /**
   * Fetch episode tracking data for a specific TV show with a one-time read.
   */
  async fetchShowTracking(
    tvShowId: number,
    userId?: string,
  ): Promise<TVShowEpisodeTracking | null> {
    const resolvedUserId = userId ?? this.getCurrentUser()?.uid
    if (!resolvedUserId) return null

    try {
      const trackingRef = this.getShowTrackingRef(resolvedUserId, tvShowId)
      const snapshot = await this.withTimeout(getDoc(trackingRef))

      if (!snapshot.exists()) {
        return null
      }

      return normalizeEpisodeTrackingDoc(snapshot.data())
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error(getFirestoreErrorMessage(error), { cause: error })
    }
  }

  /**
   * Mark an episode as watched
   */
  async markEpisodeWatched(
    tvShowId: number,
    seasonNumber: number,
    episodeNumber: number,
    episodeData: {
      episodeId: number
      episodeName: string
      episodeAirDate: string | null
    },
    showMetadata: {
      tvShowName: string
      posterPath: string | null
    },
    /** Optional cached TMDB stats to store for faster read access */
    showStats?: {
      totalEpisodes: number
      avgRuntime: number
    },
    /** Optional next episode to watch (null means caught up) */
    nextEpisode?: {
      season: number
      episode: number
      title: string
      airDate: string | null
    } | null,
    /** Auto-mark previous episodes in this season (missing ones only) */
    markPreviousEpisodesWatched = false,
    /** All episodes in current season for previous-episode auto-marking */
    seasonEpisodes?: SeasonEpisodeInput[],
  ): Promise<void> {
    try {
      const user = this.getCurrentUser()
      if (!user) throw new Error("Please sign in to continue")

      const trackingRef = this.getShowTrackingRef(user.uid, tvShowId)
      const episodeKey = this.getEpisodeKey(seasonNumber, episodeNumber)
      const now = Date.now()

      const watchedEpisode: WatchedEpisode = {
        episodeId: episodeData.episodeId,
        tvShowId,
        seasonNumber,
        episodeNumber,
        watchedAt: now,
        episodeName: episodeData.episodeName,
        episodeAirDate: episodeData.episodeAirDate,
      }

      const episodesMap: Record<string, WatchedEpisode> = {
        [episodeKey]: watchedEpisode,
      }

      let resolvedNextEpisode = nextEpisode

      if (markPreviousEpisodesWatched && seasonEpisodes?.length) {
        const snapshot = await this.withTimeout(getDoc(trackingRef))
        const existingEpisodes = snapshot.exists()
          ? normalizeEpisodeTrackingDoc(snapshot.data()).episodes
          : {}

        let earlierEpisodesAdded = false

        seasonEpisodes.forEach((seasonEpisode) => {
          if (seasonEpisode.episode_number >= episodeNumber) return

          const previousEpisodeKey = this.getEpisodeKey(
            seasonNumber,
            seasonEpisode.episode_number,
          )

          if (
            Object.prototype.hasOwnProperty.call(
              existingEpisodes,
              previousEpisodeKey,
            ) ||
            Object.prototype.hasOwnProperty.call(
              episodesMap,
              previousEpisodeKey,
            )
          ) {
            return
          }

          episodesMap[previousEpisodeKey] = {
            episodeId: seasonEpisode.id,
            tvShowId,
            seasonNumber,
            episodeNumber: seasonEpisode.episode_number,
            watchedAt: now,
            episodeName: seasonEpisode.name,
            episodeAirDate: seasonEpisode.air_date,
          }
          earlierEpisodesAdded = true
        })

        if (earlierEpisodesAdded && resolvedNextEpisode !== undefined) {
          const effectiveWatchedKeys = new Set([
            ...Object.keys(existingEpisodes),
            ...Object.keys(episodesMap),
          ])

          const nextEpKey = resolvedNextEpisode
            ? this.getEpisodeKey(
                resolvedNextEpisode.season,
                resolvedNextEpisode.episode,
              )
            : null

          if (nextEpKey && effectiveWatchedKeys.has(nextEpKey)) {
            const tmdbSeasonEpisodes = seasonEpisodes.map((ep) => ({
              id: ep.id,
              episode_number: ep.episode_number,
              name: ep.name,
              overview: "",
              air_date: ep.air_date,
              runtime: null,
              still_path: null,
              vote_average: 0,
              vote_count: 0,
              season_number: seasonNumber,
            }))

            resolvedNextEpisode = computeNextEpisode(
              { season_number: seasonNumber, episode_number: episodeNumber },
              tmdbSeasonEpisodes,
              undefined,
              effectiveWatchedKeys,
            )
          }
        }
      }

      const metadata: EpisodeTrackingMetadata = {
        tvShowName: showMetadata.tvShowName,
        posterPath: showMetadata.posterPath,
        lastUpdated: now,
        // Include cached stats if provided (undefined values are excluded by Firestore)
        ...(showStats && {
          totalEpisodes: showStats.totalEpisodes,
          avgRuntime: showStats.avgRuntime,
        }),
        // nextEpisode can be null (caught up) or object - only include if explicitly provided
        ...(resolvedNextEpisode !== undefined && {
          nextEpisode: resolvedNextEpisode,
        }),
      }

      await this.withTimeout(
        setDoc(
          trackingRef,
          {
            episodes: episodesMap,
            metadata,
          },
          { merge: true },
        ),
      )
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error(getFirestoreErrorMessage(error), { cause: error })
    }
  }

  /**
   * Mark an episode as unwatched (remove from tracking)
   */
  async markEpisodeUnwatched(
    tvShowId: number,
    seasonNumber: number,
    episodeNumber: number,
  ): Promise<void> {
    try {
      const user = this.getCurrentUser()
      if (!user) throw new Error("Please sign in to continue")

      const trackingRef = this.getShowTrackingRef(user.uid, tvShowId)
      const episodeKey = this.getEpisodeKey(seasonNumber, episodeNumber)

      try {
        await this.withTimeout(
          updateDoc(trackingRef, {
            [`episodes.${episodeKey}`]: deleteField(),
            "metadata.lastUpdated": Date.now(),
          }),
        )
      } catch (updateError) {
        // Handle Firestore "not-found" error as a no-op
        // This can happen if the document doesn't exist or was deleted between check and update
        if (isNotFoundUpdateError(updateError)) {
          // No tracking data exists, nothing to unwatch - treat as success
          return
        }
        // Re-throw other errors
        throw updateError
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error(getFirestoreErrorMessage(error), { cause: error })
    }
  }

  /**
   * Mark all episodes in a season as unwatched in a single update operation.
   */
  async markAllEpisodesUnwatched(
    tvShowId: number,
    seasonNumber: number,
    episodeNumbers: number[],
  ): Promise<void> {
    if (episodeNumbers.length === 0) return

    try {
      const user = this.getCurrentUser()
      if (!user) throw new Error("Please sign in to continue")

      const trackingRef = this.getShowTrackingRef(user.uid, tvShowId)

      const updates: Record<string, unknown> = {
        "metadata.lastUpdated": Date.now(),
      }

      episodeNumbers.forEach((episodeNumber) => {
        const key = this.getEpisodeKey(seasonNumber, episodeNumber)
        updates[`episodes.${key}`] = deleteField()
      })

      try {
        await this.withTimeout(updateDoc(trackingRef, updates))
      } catch (updateError) {
        if (isNotFoundUpdateError(updateError)) {
          return
        }
        throw updateError
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error(getFirestoreErrorMessage(error), { cause: error })
    }
  }

  /**
   * Mark all episodes in a season as watched (batch operation)
   */
  async markAllEpisodesWatched(
    tvShowId: number,
    seasonNumber: number,
    episodes: SeasonEpisodeInput[],
    showMetadata: {
      tvShowName: string
      posterPath: string | null
    },
    /** Optional cached TMDB stats to store for faster read access */
    showStats?: {
      totalEpisodes: number
      avgRuntime: number
    },
    /** Optional next episode to watch (null means caught up) */
    nextEpisode?: {
      season: number
      episode: number
      title: string
      airDate: string | null
    } | null,
  ): Promise<void> {
    try {
      const user = this.getCurrentUser()
      if (!user) throw new Error("Please sign in to continue")

      const trackingRef = this.getShowTrackingRef(user.uid, tvShowId)
      const now = Date.now()

      // Build the episodes map for batch update
      const episodesMap: Record<string, WatchedEpisode> = {}
      episodes.forEach((episode) => {
        const episodeKey = this.getEpisodeKey(
          seasonNumber,
          episode.episode_number,
        )
        episodesMap[episodeKey] = {
          episodeId: episode.id,
          tvShowId,
          seasonNumber,
          episodeNumber: episode.episode_number,
          watchedAt: now,
          episodeName: episode.name,
          episodeAirDate: episode.air_date,
        }
      })

      const metadata: EpisodeTrackingMetadata = {
        tvShowName: showMetadata.tvShowName,
        posterPath: showMetadata.posterPath,
        lastUpdated: now,
        // Include cached stats if provided
        ...(showStats && {
          totalEpisodes: showStats.totalEpisodes,
          avgRuntime: showStats.avgRuntime,
        }),
        // nextEpisode can be null (caught up) or object - only include if explicitly provided
        ...(nextEpisode !== undefined && { nextEpisode }),
      }

      // Use setDoc with merge to update all episodes at once
      await this.withTimeout(
        setDoc(
          trackingRef,
          {
            episodes: episodesMap,
            metadata,
          },
          { merge: true },
        ),
      )
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error(getFirestoreErrorMessage(error), { cause: error })
    }
  }

  /**
   * Mark multiple episodes across seasons as watched in chunks with delays
   * and cancellation support.
   * Ported from the mobile app (EpisodeTrackingService.markMultipleEpisodesWatched).
   * Chunking keeps Firestore writes small and the progress UI responsive.
   */
  async markEntireShowWatched(
    tvShowId: number,
    episodesToMark: Array<{
      seasonNumber: number
      episode: SeasonEpisodeInput
    }>,
    showMetadata: {
      tvShowName: string
      posterPath: string | null
    },
    options?: {
      batchSize?: number
      delayMs?: number
      isCancelled?: () => boolean
      onProgress?: (markedCount: number, totalCount: number) => void
    },
    /** Optional cached TMDB stats to store for faster read access */
    showStats?: {
      totalEpisodes: number
      avgRuntime: number
    },
    /** Optional next episode to watch (null means caught up) */
    nextEpisode?: {
      season: number
      episode: number
      title: string
      airDate: string | null
    } | null,
  ): Promise<{ markedCount: number; wasCancelled: boolean }> {
    const user = this.getCurrentUser()
    if (!user) throw new Error("Please sign in to continue")
    if (episodesToMark.length === 0) return { markedCount: 0, wasCancelled: false }

    const batchSize =
      typeof options?.batchSize === "number" &&
      Number.isInteger(options.batchSize) &&
      options.batchSize > 0
        ? options.batchSize
        : 10
    const delayMs =
      typeof options?.delayMs === "number" &&
      Number.isFinite(options.delayMs) &&
      options.delayMs >= 0
        ? options.delayMs
        : 300

    const trackingRef = this.getShowTrackingRef(user.uid, tvShowId)
    let markedCount = 0
    let wasCancelled = false

    for (let i = 0; i < episodesToMark.length; i += batchSize) {
      if (options?.isCancelled?.()) {
        wasCancelled = true
        break
      }

      const chunk = episodesToMark.slice(i, i + batchSize)
      const now = Date.now()
      const episodesMap: Record<string, WatchedEpisode> = {}

      chunk.forEach(({ seasonNumber, episode }) => {
        const episodeKey = this.getEpisodeKey(
          seasonNumber,
          episode.episode_number,
        )
        episodesMap[episodeKey] = {
          episodeId: episode.id,
          tvShowId,
          seasonNumber,
          episodeNumber: episode.episode_number,
          watchedAt: now,
          episodeName: episode.name,
          episodeAirDate: episode.air_date,
        }
      })

      const metadata: EpisodeTrackingMetadata = {
        tvShowName: showMetadata.tvShowName,
        posterPath: showMetadata.posterPath,
        lastUpdated: now,
        // Include cached stats if provided
        ...(showStats && {
          totalEpisodes: showStats.totalEpisodes,
          avgRuntime: showStats.avgRuntime,
        }),
        // nextEpisode can be null (caught up) or object - only include if explicitly provided
        ...(nextEpisode !== undefined && { nextEpisode }),
      }

      try {
        await this.withTimeout(
          setDoc(
            trackingRef,
            {
              episodes: episodesMap,
              metadata,
            },
            { merge: true },
          ),
        )
      } catch (error) {
        if (error instanceof Error) {
          throw error
        }
        throw new Error(getFirestoreErrorMessage(error))
      }

      markedCount += chunk.length
      options?.onProgress?.(markedCount, episodesToMark.length)

      if (i + batchSize < episodesToMark.length) {
        if (options?.isCancelled?.()) {
          wasCancelled = true
          break
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }

    return { markedCount, wasCancelled }
  }


  /**
   * Check if a specific episode is watched
   */
  isEpisodeWatched(
    seasonNumber: number,
    episodeNumber: number,
    watchedEpisodes: Record<string, WatchedEpisode>,
  ): boolean {
    const episodeKey = this.getEpisodeKey(seasonNumber, episodeNumber)
    return episodeKey in watchedEpisodes
  }

  /**
   * Clear all watched episodes for a show (removes from watch progress)
   */
  async clearAllEpisodes(tvShowId: number): Promise<void> {
    try {
      const user = this.getCurrentUser()
      if (!user) throw new Error("Please sign in to continue")

      const trackingRef = this.getShowTrackingRef(user.uid, tvShowId)
      await this.withTimeout(deleteDoc(trackingRef))
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error(getFirestoreErrorMessage(error), { cause: error })
    }
  }

  /**
   * Set whether a show is hidden from Watching Progress without modifying watched episodes.
   */
  async setHiddenFromProgress(
    tvShowId: number,
    hidden: boolean,
  ): Promise<void> {
    try {
      const user = this.getCurrentUser()
      if (!user) throw new Error("Please sign in to continue")

      const trackingRef = this.getShowTrackingRef(user.uid, tvShowId)
      await this.withTimeout(
        updateDoc(trackingRef, {
          "metadata.hiddenFromProgress": hidden,
        }),
      )
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error(getFirestoreErrorMessage(error), { cause: error })
    }
  }
}

// Export singleton instance
export const episodeTrackingService = new EpisodeTrackingService()

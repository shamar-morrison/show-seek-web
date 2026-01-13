import { auth, db } from "@/lib/firebase/config"
import type {
  EpisodeTrackingMetadata,
  SeasonProgress,
  ShowProgress,
  TVShowEpisodeTracking,
  WatchedEpisode,
} from "@/types/episode-tracking"
import type { TMDBEpisode as Episode } from "@/types/tmdb"
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore"

// Season type for progress calculation
interface Season {
  season_number: number
}

// Inline helper to extract error message
function getFirestoreErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

class EpisodeTrackingService {
  /**
   * Get reference to a TV show's episode tracking document
   */
  private getShowTrackingRef(userId: string, tvShowId: number) {
    return doc(db, "users", userId, "episode_tracking", tvShowId.toString())
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
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    })
    return Promise.race([operation, timeoutPromise])
  }

  /**
   * Subscribe to episode tracking data for a specific TV show
   */
  subscribeToShowTracking(
    tvShowId: number,
    callback: (tracking: TVShowEpisodeTracking | null) => void,
    onError?: (error: Error) => void,
  ) {
    const user = auth.currentUser
    if (!user) return () => {}

    const trackingRef = this.getShowTrackingRef(user.uid, tvShowId)

    return onSnapshot(
      trackingRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as TVShowEpisodeTracking
          callback(data)
        } else {
          // No tracking data yet - return empty structure
          callback(null)
        }
      },
      (error) => {
        console.error("[EpisodeTrackingService] Subscription error:", error)
        const message = getFirestoreErrorMessage(error)
        if (onError) {
          onError(new Error(message))
        }
        // Graceful degradation
        callback(null)
      },
    )
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
  ): Promise<void> {
    try {
      const user = auth.currentUser
      if (!user) throw new Error("Please sign in to continue")

      const trackingRef = this.getShowTrackingRef(user.uid, tvShowId)
      const episodeKey = this.getEpisodeKey(seasonNumber, episodeNumber)

      const watchedEpisode: WatchedEpisode = {
        episodeId: episodeData.episodeId,
        tvShowId,
        seasonNumber,
        episodeNumber,
        watchedAt: Date.now(),
        episodeName: episodeData.episodeName,
        episodeAirDate: episodeData.episodeAirDate,
      }

      const metadata: EpisodeTrackingMetadata = {
        tvShowName: showMetadata.tvShowName,
        posterPath: showMetadata.posterPath,
        lastUpdated: Date.now(),
        // Include cached stats if provided (undefined values are excluded by Firestore)
        ...(showStats && {
          totalEpisodes: showStats.totalEpisodes,
          avgRuntime: showStats.avgRuntime,
        }),
        // nextEpisode can be null (caught up) or object - only include if explicitly provided
        ...(nextEpisode !== undefined && { nextEpisode }),
      }

      await this.withTimeout(
        setDoc(
          trackingRef,
          {
            episodes: {
              [episodeKey]: watchedEpisode,
            },
            metadata,
          },
          { merge: true },
        ),
      )
    } catch (error) {
      throw new Error(getFirestoreErrorMessage(error))
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
      const user = auth.currentUser
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
        const errorMessage = getFirestoreErrorMessage(updateError)
        if (
          errorMessage.includes("No document to update") ||
          errorMessage.includes("not-found")
        ) {
          // No tracking data exists, nothing to unwatch - treat as success
          return
        }
        // Re-throw other errors
        throw updateError
      }
    } catch (error) {
      throw new Error(getFirestoreErrorMessage(error))
    }
  }

  /**
   * Mark all episodes in a season as watched (batch operation)
   */
  async markAllEpisodesWatched(
    tvShowId: number,
    seasonNumber: number,
    episodes: (Pick<Episode, "id" | "episode_number" | "name"> & {
      air_date: string | null
    })[],
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
      const user = auth.currentUser
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
      throw new Error(getFirestoreErrorMessage(error))
    }
  }

  /**
   * Calculate progress for a specific season
   * Excludes unaired episodes from total count
   */
  calculateSeasonProgress(
    seasonNumber: number,
    episodes: Episode[],
    watchedEpisodes: Record<string, WatchedEpisode>,
  ): SeasonProgress {
    const today = new Date()

    // Filter to only include aired episodes
    const airedEpisodes = episodes.filter(
      (ep) => ep.air_date && new Date(ep.air_date) <= today,
    )

    // Count watched episodes
    const watchedCount = airedEpisodes.filter((ep) =>
      this.isEpisodeWatched(seasonNumber, ep.episode_number, watchedEpisodes),
    ).length

    const totalCount = episodes.length
    const totalAiredCount = airedEpisodes.length
    const percentage =
      totalAiredCount > 0 ? (watchedCount / totalAiredCount) * 100 : 0

    return {
      seasonNumber,
      watchedCount,
      totalCount,
      totalAiredCount,
      percentage,
    }
  }

  /**
   * Calculate overall progress for a TV show
   * Excludes unaired episodes and Season 0 (specials)
   */
  calculateShowProgress(
    seasons: Season[],
    allEpisodes: Episode[],
    watchedEpisodes: Record<string, WatchedEpisode>,
  ): ShowProgress {
    const today = new Date()

    // Filter out Season 0 (specials) and unaired episodes
    const validEpisodes = allEpisodes.filter((ep) => ep.season_number > 0)
    const airedEpisodes = validEpisodes.filter(
      (ep) => ep.air_date && new Date(ep.air_date) <= today,
    )

    // Count watched episodes (only from aired episodes to match denominator)
    const totalWatched = airedEpisodes.filter((ep) =>
      this.isEpisodeWatched(
        ep.season_number,
        ep.episode_number,
        watchedEpisodes,
      ),
    ).length

    const totalEpisodes = validEpisodes.length
    const totalAiredEpisodes = airedEpisodes.length
    const percentage =
      totalAiredEpisodes > 0 ? (totalWatched / totalAiredEpisodes) * 100 : 0

    // Calculate progress per season
    const seasonProgress = seasons
      .filter((s) => s.season_number > 0)
      .map((season) => {
        const seasonEpisodes = allEpisodes.filter(
          (ep) => ep.season_number === season.season_number,
        )
        return this.calculateSeasonProgress(
          season.season_number,
          seasonEpisodes,
          watchedEpisodes,
        )
      })

    return {
      totalWatched,
      totalEpisodes,
      totalAiredEpisodes,
      percentage,
      seasonProgress,
    }
  }

  /**
   * Get all watched shows for a user
   */
  async getAllWatchedShows(userId: string): Promise<TVShowEpisodeTracking[]> {
    try {
      const trackingCollectionRef = collection(
        db,
        "users",
        userId,
        "episode_tracking",
      )

      const snapshot = await this.withTimeout(getDocs(trackingCollectionRef))

      return snapshot.docs.map((doc) => {
        const data = doc.data() as TVShowEpisodeTracking
        // Ensure the ID is included or available if needed, though usually it's in metadata or derived
        return data
      })
    } catch (error) {
      console.error(
        "[EpisodeTrackingService] Error fetching all watched shows:",
        error,
      )
      throw new Error(getFirestoreErrorMessage(error))
    }
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
      const user = auth.currentUser
      if (!user) throw new Error("Please sign in to continue")

      const trackingRef = this.getShowTrackingRef(user.uid, tvShowId)
      await this.withTimeout(deleteDoc(trackingRef))
    } catch (error) {
      throw new Error(getFirestoreErrorMessage(error))
    }
  }
}

// Export singleton instance
export const episodeTrackingService = new EpisodeTrackingService()

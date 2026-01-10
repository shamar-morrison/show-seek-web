// Force Node.js runtime for firebase-admin compatibility
export const runtime = "nodejs"

import { adminAuth, adminDb } from "@/lib/firebase/admin"
import {
  getHistory,
  getListItems,
  getRatings,
  getUserLists,
  getWatchlist,
  refreshAccessToken,
} from "@/lib/trakt"
import { FieldValue, Firestore, WriteBatch } from "firebase-admin/firestore"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export interface SyncResult {
  success: boolean
  movies: number
  shows: number
  episodes: number
  ratings: number
  lists: number
  favorites: number
  watchlist: number
}

/**
 * Helper class to manage Firestore batch writes with automatic chunking.
 * Firestore limits batches to 500 operations, so this class commits
 * automatically when that limit is reached.
 */
class BatchWriter {
  private batch: WriteBatch
  private operationCount = 0
  private readonly MAX_OPERATIONS = 500

  constructor(private db: Firestore) {
    this.batch = db.batch()
  }

  set(
    ref: FirebaseFirestore.DocumentReference,
    data: FirebaseFirestore.DocumentData,
    options?: FirebaseFirestore.SetOptions,
  ): void {
    if (options) {
      this.batch.set(ref, data, options)
    } else {
      this.batch.set(ref, data)
    }
    this.operationCount++
  }

  /**
   * Check if we've reached the operation limit and need to commit
   */
  shouldCommit(): boolean {
    return this.operationCount >= this.MAX_OPERATIONS
  }

  /**
   * Commit current batch if it has operations and reset for more writes
   */
  async commitIfNeeded(): Promise<void> {
    if (this.operationCount > 0) {
      await this.batch.commit()
      this.batch = this.db.batch()
      this.operationCount = 0
    }
  }

  /**
   * Final commit - commits any remaining operations
   */
  async commit(): Promise<void> {
    if (this.operationCount > 0) {
      await this.batch.commit()
    }
  }

  get count(): number {
    return this.operationCount
  }
}

export async function POST() {
  // Constants for rate limiting and lock management
  const SYNC_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes
  const SYNC_LOCK_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes - auto-expire stale locks

  let userId: string | null = null

  try {
    // Get session cookie
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("session")?.value

    if (!sessionCookie || !adminAuth || !adminDb) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify the session and get user ID
    try {
      const decodedToken = await adminAuth.verifySessionCookie(
        sessionCookie,
        true,
      )
      userId = decodedToken.uid
    } catch {
      // Invalid or expired session cookie
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRef = adminDb.doc(`users/${userId}`)

    // --- ATOMIC LOCK ACQUISITION ---
    // Use a transaction to atomically check rate limits and acquire sync lock
    let userData: FirebaseFirestore.DocumentData
    let accessToken: string
    let refreshToken: string

    try {
      const transactionResult = await adminDb.runTransaction(async (tx) => {
        const userDoc = await tx.get(userRef)

        if (!userDoc.exists || !userDoc.data()?.traktConnected) {
          throw new Error("NOT_CONNECTED")
        }

        const data = userDoc.data()!

        // Validate tokens
        const storedAccessToken = data.traktAccessToken
        const storedRefreshToken = data.traktRefreshToken

        if (
          typeof storedAccessToken !== "string" ||
          !storedAccessToken ||
          typeof storedRefreshToken !== "string" ||
          !storedRefreshToken
        ) {
          throw new Error("REAUTH_REQUIRED")
        }

        // Check rate limit (cooldown)
        const lastSyncRaw = data.traktLastSyncAt
        let lastSyncMs = 0
        if (typeof lastSyncRaw?.toMillis === "function") {
          lastSyncMs = lastSyncRaw.toMillis()
        } else if (lastSyncRaw instanceof Date) {
          lastSyncMs = lastSyncRaw.getTime()
        } else if (typeof lastSyncRaw === "number") {
          lastSyncMs = lastSyncRaw
        }

        const now = Date.now()
        const timeSinceLastSync = now - lastSyncMs
        if (lastSyncMs > 0 && timeSinceLastSync < SYNC_COOLDOWN_MS) {
          const retryAfterSeconds = Math.ceil(
            (SYNC_COOLDOWN_MS - timeSinceLastSync) / 1000,
          )
          throw new Error(`RATE_LIMITED:${retryAfterSeconds}`)
        }

        // Check if sync is already in progress (with stale lock detection)
        const syncInProgressRaw = data.syncInProgressAt
        let syncInProgressMs = 0
        if (typeof syncInProgressRaw?.toMillis === "function") {
          syncInProgressMs = syncInProgressRaw.toMillis()
        } else if (syncInProgressRaw instanceof Date) {
          syncInProgressMs = syncInProgressRaw.getTime()
        } else if (typeof syncInProgressRaw === "number") {
          syncInProgressMs = syncInProgressRaw
        }

        // If lock exists and hasn't expired, reject the request
        if (
          syncInProgressMs > 0 &&
          now - syncInProgressMs < SYNC_LOCK_TIMEOUT_MS
        ) {
          throw new Error("SYNC_IN_PROGRESS")
        }

        // Acquire the lock atomically
        tx.update(userRef, {
          syncInProgressAt: FieldValue.serverTimestamp(),
        })

        return {
          userData: data,
          accessToken: storedAccessToken,
          refreshToken: storedRefreshToken,
        }
      })

      userData = transactionResult.userData
      accessToken = transactionResult.accessToken
      refreshToken = transactionResult.refreshToken
    } catch (error) {
      const message = error instanceof Error ? error.message : ""

      if (message === "NOT_CONNECTED") {
        return NextResponse.json(
          { error: "Not connected to Trakt" },
          { status: 400 },
        )
      }

      if (message === "REAUTH_REQUIRED") {
        return NextResponse.json(
          {
            error: "Trakt re-authentication required",
            code: "REAUTH_REQUIRED",
          },
          { status: 401 },
        )
      }

      if (message.startsWith("RATE_LIMITED:")) {
        const retryAfterSeconds = parseInt(message.split(":")[1], 10)
        return NextResponse.json(
          {
            error: "Sync rate limit exceeded",
            retryAfter: retryAfterSeconds,
            message: `Please wait ${Math.ceil(retryAfterSeconds / 60)} minute(s) before syncing again`,
          },
          {
            status: 429,
            headers: { "Retry-After": String(retryAfterSeconds) },
          },
        )
      }

      if (message === "SYNC_IN_PROGRESS") {
        return NextResponse.json(
          {
            error: "Sync already in progress",
            message:
              "A sync is already running. Please wait for it to complete.",
          },
          { status: 409 },
        )
      }

      throw error
    }

    // --- SYNC LOGIC (lock is now held) ---
    try {
      // Compute expiresMs robustly: handle Firestore Timestamp, Date, number, or missing/invalid
      let expiresMs: number
      const expiresRaw = userData.traktTokenExpiresAt
      if (typeof expiresRaw?.toMillis === "function") {
        // Firestore Timestamp
        expiresMs = expiresRaw.toMillis()
      } else if (expiresRaw instanceof Date) {
        expiresMs = expiresRaw.getTime()
      } else if (typeof expiresRaw === "number") {
        expiresMs = expiresRaw
      } else {
        // Missing or invalid - treat as expired
        expiresMs = 0
      }

      // Refresh token if expired or if expiry is missing/invalid
      if (!Number.isFinite(expiresMs) || Date.now() > expiresMs - 60000) {
        try {
          const newTokens = await refreshAccessToken(refreshToken)
          accessToken = newTokens.access_token
          refreshToken = newTokens.refresh_token

          await adminDb.doc(`users/${userId}`).update({
            traktAccessToken: accessToken,
            traktRefreshToken: refreshToken,
            traktTokenExpiresAt: new Date(
              (newTokens.created_at + newTokens.expires_in) * 1000,
            ),
          })
        } catch (error) {
          console.error("Failed to refresh token:", error)
          return NextResponse.json(
            { error: "Token refresh failed" },
            { status: 401 },
          )
        }
      }

      const result: SyncResult = {
        success: true,
        movies: 0,
        shows: 0,
        episodes: 0,
        ratings: 0,
        lists: 0,
        favorites: 0,
        watchlist: 0,
      }

      // Fetch all data from Trakt in parallel
      const [
        movieHistory,
        episodeHistory,
        movieRatings,
        showRatings,
        episodeRatings,
        movieWatchlist,
        showWatchlist,
        customLists,
      ] = await Promise.all([
        getHistory(accessToken, "movies", 1000),
        getHistory(accessToken, "episodes", 1000),
        getRatings(accessToken, "movies"),
        getRatings(accessToken, "shows"),
        getRatings(accessToken, "episodes"),
        getWatchlist(accessToken, "movies"),
        getWatchlist(accessToken, "shows"),
        getUserLists(accessToken),
      ])

      if (process.env.DEBUG_SYNC) {
        console.log("[SYNC] Raw counts from Trakt API:")
        console.log(`  - Movie history: ${movieHistory.length}`)
        console.log(`  - Episode history: ${episodeHistory.length}`)
        console.log(`  - Movie watchlist: ${movieWatchlist.length}`)
        console.log(`  - Show watchlist: ${showWatchlist.length}`)
        console.log(`  - Movie ratings: ${movieRatings.length}`)
        console.log(`  - Show ratings: ${showRatings.length}`)
        console.log(`  - Episode ratings: ${episodeRatings.length}`)
      }

      // Use BatchWriter to automatically chunk commits at 500 operations
      const batchWriter = new BatchWriter(adminDb)

      // --- MOVIE HISTORY → already-watched list ---
      const alreadyWatchedItems: Record<string, unknown> = {}
      const seenMovies = new Set<number>()
      for (const item of movieHistory) {
        if (!item.movie?.ids.tmdb) continue
        const tmdbId = item.movie.ids.tmdb
        if (seenMovies.has(tmdbId)) continue
        seenMovies.add(tmdbId)

        alreadyWatchedItems[String(tmdbId)] = {
          id: tmdbId,
          media_type: "movie",
          title: item.movie.title,
          poster_path: null, // Will be enriched later
          release_date: null,
          addedAt: new Date(item.watched_at).getTime(),
        }
        result.movies++
      }

      // Always write the list (even if empty) to clear stale data
      batchWriter.set(adminDb.doc(`users/${userId}/lists/already-watched`), {
        name: "Already Watched",
        items: alreadyWatchedItems,
        updatedAt: FieldValue.serverTimestamp(),
      })
      if (batchWriter.shouldCommit()) await batchWriter.commitIfNeeded()

      // --- EPISODE HISTORY → episode_tracking ---
      // Group episodes by show
      const showEpisodes = new Map<
        number,
        {
          show: { title: string; tmdbId: number }
          episodes: Map<string, unknown>
        }
      >()

      for (const item of episodeHistory) {
        if (!item.show?.ids.tmdb || !item.episode) continue
        const tvShowId = item.show.ids.tmdb
        const episodeKey = `${item.episode.season}_${item.episode.number}`

        if (!showEpisodes.has(tvShowId)) {
          showEpisodes.set(tvShowId, {
            show: { title: item.show.title, tmdbId: tvShowId },
            episodes: new Map(),
          })
        }

        const showData = showEpisodes.get(tvShowId)!
        if (!showData.episodes.has(episodeKey)) {
          showData.episodes.set(episodeKey, {
            episodeId: item.episode.ids.tmdb || 0,
            tvShowId,
            seasonNumber: item.episode.season,
            episodeNumber: item.episode.number,
            watchedAt: new Date(item.watched_at).getTime(),
            episodeName: item.episode.title,
            episodeAirDate: null,
          })
          result.episodes++
        }
      }

      result.shows = showEpisodes.size

      // --- DELETE STALE EPISODE TRACKING before writing fresh data ---
      // Query all existing episode_tracking docs and delete ones not in current Trakt data
      const existingEpisodeTrackingSnap = await adminDb
        .collection(`users/${userId}/episode_tracking`)
        .get()
      const freshShowIds = new Set([...showEpisodes.keys()].map(String))

      // Commit any pending writes before deletes
      await batchWriter.commit()

      // Delete stale episode_tracking documents
      const staleEpisodeTrackingDocs = existingEpisodeTrackingSnap.docs.filter(
        (doc) => !freshShowIds.has(doc.id),
      )
      if (staleEpisodeTrackingDocs.length > 0) {
        const deleteBatch = adminDb.batch()
        for (const doc of staleEpisodeTrackingDocs) {
          deleteBatch.delete(doc.ref)
        }
        await deleteBatch.commit()
      }

      // Re-create BatchWriter for remaining operations
      const batchWriter2 = new BatchWriter(adminDb)

      for (const [tvShowId, showData] of showEpisodes) {
        const episodesObj: Record<string, unknown> = {}
        for (const [key, episode] of showData.episodes) {
          episodesObj[key] = episode
        }

        // Full overwrite (no merge) to ensure deleted episodes are removed
        batchWriter2.set(
          adminDb.doc(`users/${userId}/episode_tracking/${tvShowId}`),
          {
            episodes: episodesObj,
            metadata: {
              tvShowName: showData.show.title,
              posterPath: null, // Will be enriched later
              lastUpdated: Date.now(),
            },
          },
        )
        if (batchWriter2.shouldCommit()) await batchWriter2.commitIfNeeded()
      }

      // --- RATINGS ---
      // First, collect all fresh rating doc IDs from Trakt
      const freshRatingDocIds = new Set<string>()

      for (const item of movieRatings) {
        if (!item.movie?.ids.tmdb) continue
        freshRatingDocIds.add(`movie-${item.movie.ids.tmdb}`)
      }
      for (const item of showRatings) {
        if (!item.show?.ids.tmdb) continue
        freshRatingDocIds.add(`tv-${item.show.ids.tmdb}`)
      }
      for (const item of episodeRatings) {
        if (!item.show?.ids.tmdb || !item.episode) continue
        const docId = `episode-${item.show.ids.tmdb}-${item.episode.season}-${item.episode.number}`
        freshRatingDocIds.add(docId)
      }

      // Delete stale ratings not present in current Trakt data
      const existingRatingsSnap = await adminDb
        .collection(`users/${userId}/ratings`)
        .get()
      const staleRatingDocs = existingRatingsSnap.docs.filter(
        (doc) => !freshRatingDocIds.has(doc.id),
      )
      if (staleRatingDocs.length > 0) {
        // Delete in batches of 500
        for (let i = 0; i < staleRatingDocs.length; i += 500) {
          const chunk = staleRatingDocs.slice(i, i + 500)
          const deleteBatch = adminDb.batch()
          for (const doc of chunk) {
            deleteBatch.delete(doc.ref)
          }
          await deleteBatch.commit()
        }
      }

      // Write fresh ratings (full overwrite, no merge)
      for (const item of movieRatings) {
        if (!item.movie?.ids.tmdb) continue
        const tmdbId = item.movie.ids.tmdb
        const docId = `movie-${tmdbId}`

        batchWriter2.set(adminDb.doc(`users/${userId}/ratings/${docId}`), {
          id: tmdbId,
          mediaType: "movie",
          rating: item.rating,
          title: item.movie.title,
          posterPath: null,
          releaseDate: null,
          ratedAt: new Date(item.rated_at).getTime(),
        })
        if (batchWriter2.shouldCommit()) await batchWriter2.commitIfNeeded()
        result.ratings++
      }

      for (const item of showRatings) {
        if (!item.show?.ids.tmdb) continue
        const tmdbId = item.show.ids.tmdb
        const docId = `tv-${tmdbId}`

        batchWriter2.set(adminDb.doc(`users/${userId}/ratings/${docId}`), {
          id: tmdbId,
          mediaType: "tv",
          rating: item.rating,
          title: item.show.title,
          posterPath: null,
          releaseDate: null,
          ratedAt: new Date(item.rated_at).getTime(),
        })
        if (batchWriter2.shouldCommit()) await batchWriter2.commitIfNeeded()
        result.ratings++
      }

      for (const item of episodeRatings) {
        if (!item.show?.ids.tmdb || !item.episode) continue
        const tvShowId = item.show.ids.tmdb
        const season = item.episode.season
        const episode = item.episode.number
        const docId = `episode-${tvShowId}-${season}-${episode}`

        batchWriter2.set(adminDb.doc(`users/${userId}/ratings/${docId}`), {
          id: docId,
          mediaType: "episode",
          rating: item.rating,
          episodeName: item.episode.title,
          tvShowId,
          tvShowName: item.show.title,
          seasonNumber: season,
          episodeNumber: episode,
          posterPath: null,
          ratedAt: new Date(item.rated_at).getTime(),
        })
        if (batchWriter2.shouldCommit()) await batchWriter2.commitIfNeeded()
        result.ratings++
      }

      // --- WATCHLIST ---
      const watchlistItems: Record<string, unknown> = {}
      for (const item of movieWatchlist) {
        if (!item.movie?.ids.tmdb) {
          if (process.env.DEBUG_SYNC) {
            console.log(
              "[SYNC] Skipping movie watchlist item - no TMDB ID:",
              item.movie?.title,
            )
          }
          continue
        }
        const tmdbId = item.movie.ids.tmdb

        watchlistItems[String(tmdbId)] = {
          id: tmdbId,
          media_type: "movie",
          title: item.movie.title,
          poster_path: null,
          release_date: null,
          addedAt: new Date(item.listed_at).getTime(),
        }
        result.watchlist++
      }

      for (const item of showWatchlist) {
        if (!item.show?.ids.tmdb) {
          if (process.env.DEBUG_SYNC) {
            console.log(
              "[SYNC] Skipping show watchlist item - no TMDB ID:",
              item.show?.title,
            )
          }
          continue
        }
        const tmdbId = item.show.ids.tmdb

        watchlistItems[String(tmdbId)] = {
          id: tmdbId,
          media_type: "tv",
          title: item.show.title,
          poster_path: null,
          first_air_date: null,
          addedAt: new Date(item.listed_at).getTime(),
        }
        result.watchlist++
      }

      // Always write the list (even if empty) to clear stale data
      batchWriter2.set(adminDb.doc(`users/${userId}/lists/watchlist`), {
        name: "Should Watch",
        items: watchlistItems,
        updatedAt: FieldValue.serverTimestamp(),
      })
      if (batchWriter2.shouldCommit()) await batchWriter2.commitIfNeeded()

      // --- CUSTOM LISTS (including Favorites) ---
      if (process.env.DEBUG_SYNC) {
        console.log(
          "[SYNC] Custom lists from Trakt:",
          customLists.map((l) => l.name),
        )
      }

      // Fetch all list items in parallel for better performance
      const listItemsResults = await Promise.all(
        customLists.map(async (list) => {
          const listItems = await getListItems(accessToken, list.ids.slug)
          return { list, listItems }
        }),
      )

      for (const { list, listItems } of listItemsResults) {
        if (process.env.DEBUG_SYNC) {
          console.log(
            `[SYNC] List '${list.name}' has ${listItems.length} items`,
          )
        }
        const items: Record<string, unknown> = {}

        for (const item of listItems) {
          if (item.type === "movie" && item.movie?.ids.tmdb) {
            items[String(item.movie.ids.tmdb)] = {
              id: item.movie.ids.tmdb,
              media_type: "movie",
              title: item.movie.title,
              poster_path: null,
              release_date: null,
              addedAt: new Date(item.listed_at).getTime(),
            }
          } else if (item.type === "show" && item.show?.ids.tmdb) {
            items[String(item.show.ids.tmdb)] = {
              id: item.show.ids.tmdb,
              media_type: "tv",
              title: item.show.title,
              poster_path: null,
              first_air_date: null,
              addedAt: new Date(item.listed_at).getTime(),
            }
          }
        }

        // Check if this is the "Favorites" list
        const isFavorites = list.name.toLowerCase() === "favorites"
        const listId = isFavorites ? "favorites" : list.ids.slug

        // Always write the list (even if empty) to clear stale data
        batchWriter2.set(adminDb.doc(`users/${userId}/lists/${listId}`), {
          name: list.name,
          items,
          updatedAt: FieldValue.serverTimestamp(),
          isCustom: !isFavorites,
        })
        if (batchWriter2.shouldCommit()) await batchWriter2.commitIfNeeded()

        if (isFavorites) {
          result.favorites = Object.keys(items).length
        } else {
          result.lists++
        }
      }

      // Commit any remaining operations
      await batchWriter2.commit()

      // Update last sync time, sync result, and release lock on user document
      await adminDb.doc(`users/${userId}`).update({
        traktLastSyncAt: FieldValue.serverTimestamp(),
        traktLastSyncResult: result,
        syncInProgressAt: FieldValue.delete(),
      })

      return NextResponse.json(result)
    } catch (syncError) {
      // Release lock on sync failure
      if (userId) {
        try {
          await adminDb.doc(`users/${userId}`).update({
            syncInProgressAt: FieldValue.delete(),
          })
        } catch (cleanupError) {
          console.error("Failed to release sync lock:", cleanupError)
        }
      }
      throw syncError
    }
  } catch (error) {
    console.error("Trakt sync error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Sync failed",
      },
      { status: 500 },
    )
  }
}

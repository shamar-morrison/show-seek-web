import { fetchMeasuredShowRuntime, fetchMovieDetails } from "@/app/server-actions/tmdb"
import { getFirebaseDb } from "@/lib/firebase/config"
import { enqueueRateLimitedRequest } from "@/lib/react-query/rate-limited-query"
import type {
  WatchTimeEpisodeRef,
  WatchTimeListRef,
} from "@/hooks/use-watch-time-stats"
import { doc, setDoc, updateDoc } from "firebase/firestore"

/**
 * Session-scoped backfill budget (mobile parity: MAX_BACKFILL_LOOKUPS_PER_LOAD).
 * Shared across show + movie lookups. Counts TMDB lookups, not stamps.
 */
export const WATCH_TIME_BACKFILL_BUDGET = 10

/** Lookup keys already attempted this session (dedupe across mounts). */
const attemptedLookupKeys = new Set<string>()

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes("429") ||
    message.toLowerCase().includes("rate limit") ||
    message.toLowerCase().includes("timed out") ||
    message.toLowerCase().includes("timeout")
  )
}

async function stampEpisodeRuntime(
  userId: string,
  tvShowId: number,
  episodeKey: string,
  runtimeMinutes: number,
): Promise<void> {
  const trackingRef = doc(
    getFirebaseDb(),
    "users",
    userId,
    "episode_tracking",
    tvShowId.toString(),
  )
  await setDoc(
    trackingRef,
    { episodes: { [episodeKey]: { runtimeMinutes } } },
    { merge: true },
  )
}

async function stampListItemRuntime(
  userId: string,
  listId: string,
  itemKey: string,
  runtimeMinutes: number,
): Promise<void> {
  const listRef = doc(getFirebaseDb(), "users", userId, "lists", listId)
  await updateDoc(listRef, {
    [`items.${itemKey}.runtimeMinutes`]: runtimeMinutes,
  })
}

export interface WatchTimeBackfillInput {
  userId: string
  unstampedEpisodes: WatchTimeEpisodeRef[]
  unstampedListItems: WatchTimeListRef[]
  /** Resolved with true when at least one measured runtime was stamped. */
  onStampsSettled?: (didStamp: boolean) => void
}

/**
 * Lazily backfill missing measured runtimes (mobile WatchTimeBackfill intent).
 *
 * - Distinct-title dedupe: one TMDB lookup per show (covers all its
 *   episodes) and one per movie, capped by a session-scoped budget.
 * - Lookups go through the shared rate-limited queue and hit the same cached
 *   detail fetches as detail pages (no new KV cache keys).
 * - Only measured values (> 0) are stamped. Fallbacks are never persisted.
 * - Aborts remaining lookups on 429/timeout.
 * - Fire-and-forget: callers continue rendering with in-memory fallbacks and
 *   refresh via onStampsSettled.
 */
export function backfillWatchTimeRuntimes({
  userId,
  unstampedEpisodes,
  unstampedListItems,
  onStampsSettled,
}: WatchTimeBackfillInput): void {
  // Group episodes by show: one lookup covers every episode of the show.
  const episodesByShow = new Map<number, WatchTimeEpisodeRef[]>()
  for (const episode of unstampedEpisodes) {
    const group = episodesByShow.get(episode.tvShowId) ?? []
    group.push(episode)
    episodesByShow.set(episode.tvShowId, group)
  }

  // Distinct movies needing runtimes.
  const moviesById = new Map<number, WatchTimeListRef>()
  // Distinct TV shows from lists (manual already-watched adds have no
  // episode records, so the show runtime stamps the list item directly).
  const tvListsByShowId = new Map<number, WatchTimeListRef[]>()
  for (const item of unstampedListItems) {
    if (item.mediaType === "movie") {
      if (!moviesById.has(item.mediaId)) {
        moviesById.set(item.mediaId, item)
      }
      continue
    }
    const group = tvListsByShowId.get(item.mediaId) ?? []
    group.push(item)
    tvListsByShowId.set(item.mediaId, group)
  }

  type LookupTask =
    | { kind: "show"; tvShowId: number }
    | { kind: "movie"; mediaId: number }
    | { kind: "tv-list"; tvShowId: number }

  const tasks: LookupTask[] = []
  for (const tvShowId of episodesByShow.keys()) {
    const key = `tv:${tvShowId}`
    if (attemptedLookupKeys.has(key)) continue
    tasks.push({ kind: "show", tvShowId })
  }
  // TV list lookups share the show-runtime lookup: if the show's episodes
  // are also being resolved, one lookup covers both.
  for (const tvShowId of tvListsByShowId.keys()) {
    const key = `tv:${tvShowId}`
    if (attemptedLookupKeys.has(key)) continue
    if (episodesByShow.has(tvShowId)) continue
    tasks.push({ kind: "tv-list", tvShowId })
  }
  for (const mediaId of moviesById.keys()) {
    const key = `movie:${mediaId}`
    if (attemptedLookupKeys.has(key)) continue
    tasks.push({ kind: "movie", mediaId })
  }

  if (tasks.length === 0) {
    onStampsSettled?.(false)
    return
  }

  // Reserve budget for this run (session-scoped; unattempted tasks keep
  // their keys unmarked so a later run can still try them).
  const budgeted = tasks.slice(0, WATCH_TIME_BACKFILL_BUDGET)
  for (const task of budgeted) {
    attemptedLookupKeys.add(
      task.kind === "movie" ? `movie:${task.mediaId}` : `tv:${task.tvShowId}`,
    )
  }

  const stampShowRuntime = async (
    tvShowId: number,
    runtime: number,
  ): Promise<boolean> => {
    const episodes = episodesByShow.get(tvShowId) ?? []
    const listItems = tvListsByShowId.get(tvShowId) ?? []
    if (episodes.length === 0 && listItems.length === 0) return false
    await Promise.allSettled([
      ...episodes.map((episode) =>
        stampEpisodeRuntime(userId, tvShowId, episode.episodeKey, runtime),
      ),
      ...listItems.map((item) =>
        stampListItemRuntime(userId, item.listId, item.itemKey, runtime),
      ),
    ])
    return true
  }

  void (async () => {
    let didStamp = false
    let aborted = false

    for (const task of budgeted) {
      if (aborted) break

      try {
        if (task.kind === "show" || task.kind === "tv-list") {
          const runtime = await enqueueRateLimitedRequest(
            fetchMeasuredShowRuntime,
            task.tvShowId,
          )
          if (typeof runtime === "number" && runtime > 0) {
            didStamp = (await stampShowRuntime(task.tvShowId, runtime)) || didStamp
          }
        } else {
          const details = await enqueueRateLimitedRequest(
            fetchMovieDetails,
            task.mediaId,
          )
          const runtime = details?.runtime
          if (typeof runtime === "number" && runtime > 0) {
            const item = moviesById.get(task.mediaId)
            if (item) {
              await stampListItemRuntime(
                userId,
                item.listId,
                item.itemKey,
                runtime,
              )
              didStamp = true
            }
          }
        }
      } catch (error) {
        if (isRateLimitError(error)) {
          aborted = true
        }
        // Non-rate-limit failures: skip this title, continue with the rest.
      }
    }

    onStampsSettled?.(didStamp)
  })()
}

/** Test/session escape hatch: allow a fresh budget. */
export function resetWatchTimeBackfillBudget(): void {
  attemptedLookupKeys.clear()
}

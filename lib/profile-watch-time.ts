/**
 * Read-only Total Hours Watched selector for the profile header.
 *
 * Ports mobile's Stats overview aggregate exactly
 * (`HistoryService.fetchUserHistory`, `src/services/HistoryService.ts:532-534`):
 * the sum of episode minutes plus already-watched list minutes inside the
 * trailing 6-month window. No writes, no backfill, no new Firestore queries —
 * callers pass the already-subscribed `useEpisodeTracking` / `useLists` data.
 *
 * Mobile lines matched:
 * - Cutoff: `getMonthsAgoTimestamp` (`HistoryService.ts:69-75`) — N months
 *   back, snapped to the 1st at midnight.
 * - Episode gate: `watchedAt >= cutoff` (`:345`).
 * - List gate: `addedAt` truthy and `>= cutoff`, only
 *   `list.id === 'already-watched'` (`:365-388`).
 * - Episode minutes: stamped `runtimeMinutes` else 45 (`:417-420`).
 * - List minutes: stamped `runtimeMinutes` else movie ? 0 : 45 (`:421-429`).
 * - Guard: `!= null && > 0` (`:396,405,418,427`). The normalizer only ever
 *   yields finite numbers or absent, so the stricter finite-number check here
 *   agrees with mobile on all real inputs.
 * - Rewatches count once: episodes are keyed `{season}_{episode}` and list
 *   items are keyed by media key, so repeat watches overwrite rather than
 *   duplicate.
 * - `avgRuntime` is ignored, matching mobile (it is never read for totals).
 */

import type { TVShowEpisodeTracking } from "@/types/episode-tracking"
import type { UserList } from "@/types/list"

/** Fallback minutes per unstamped episode/TV item (mobile parity). */
export const EPISODE_RUNTIME_FALLBACK_MINUTES = 45

/** Months of history included in the total (mobile parity). */
export const WATCH_TIME_MONTHS_BACK = 6

/** List whose items count toward watch time (mobile parity). */
export const ALREADY_WATCHED_LIST_ID = "already-watched"

/**
 * Mobile `getMonthsAgoTimestamp` port: N months back from `now`, snapped to
 * the 1st of that month at local midnight.
 */
export function getMonthsAgoTimestamp(
  months: number,
  now: number = Date.now(),
): number {
  const date = new Date(now)
  date.setMonth(date.getMonth() - months)
  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function isMeasuredRuntime(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
  )
}

function episodeMinutes(runtimeMinutes: unknown): number {
  if (isMeasuredRuntime(runtimeMinutes)) return runtimeMinutes
  return EPISODE_RUNTIME_FALLBACK_MINUTES
}

function listItemMinutes(
  runtimeMinutes: unknown,
  mediaType: unknown,
): number {
  if (isMeasuredRuntime(runtimeMinutes)) return runtimeMinutes
  return mediaType === "movie" ? 0 : EPISODE_RUNTIME_FALLBACK_MINUTES
}

/**
 * Sum total watch minutes across episode tracking + the already-watched list
 * inside the trailing 6-month window. Pure function of cached data.
 */
export function computeProfileWatchTime(
  tracking: Map<string, TVShowEpisodeTracking>,
  lists: UserList[],
  now: number = Date.now(),
): number {
  const cutoff = getMonthsAgoTimestamp(WATCH_TIME_MONTHS_BACK, now)

  let total = 0

  for (const doc of tracking.values()) {
    const episodes = doc?.episodes
    if (!episodes || typeof episodes !== "object") continue
    for (const episode of Object.values(episodes)) {
      if (!episode || episode.watchedAt < cutoff) continue
      total += episodeMinutes(episode.runtimeMinutes)
    }
  }

  const alreadyWatched = lists.find(
    (list) => list?.id === ALREADY_WATCHED_LIST_ID,
  )
  const items = alreadyWatched?.items
  if (items && typeof items === "object") {
    for (const item of Object.values(items)) {
      if (!item || !item.addedAt || item.addedAt < cutoff) continue
      total += listItemMinutes(item.runtimeMinutes, item.media_type)
    }
  }

  return total
}

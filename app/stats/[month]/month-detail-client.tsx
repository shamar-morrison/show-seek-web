"use client"

import { useWatchTimeStats } from "@/hooks/use-watch-time-stats"
import { formatWatchHours } from "@/lib/format-watch-time"
import {
  ArrowLeft01Icon,
  Clock01Icon,
  Film01Icon,
  Tv01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"

/**
 * Month-detail drill-down. Reads the shared stats caches only — no backfill
 * fires here by design (see the route contract in page.tsx).
 */
export function MonthDetailClient({ monthKey }: { monthKey: string }) {
  const stats = useWatchTimeStats()
  const month = stats.months.find((m) => m.key === monthKey)

  if (stats.loading) {
    return (
      <div className="space-y-6 pb-16" aria-label="Loading month stats">
        <div className="h-8 w-48 animate-pulse rounded bg-white/5" />
        <div className="h-24 animate-pulse rounded-xl bg-white/5" />
        <div className="h-64 animate-pulse rounded-xl bg-white/5" />
      </div>
    )
  }

  if (!month) {
    return (
      <div className="space-y-4 pb-16">
        <Link
          href="/stats"
          className="inline-flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
          Back to stats
        </Link>
        <h1 className="text-3xl font-bold text-white">No activity</h1>
        <p className="text-sm text-muted-foreground">
          Nothing was tracked in this month.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-16">
      <div>
        <Link
          href="/stats"
          className="inline-flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
          Back to stats
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-white">{month.label}</h1>
        <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3">
          <HugeiconsIcon icon={Clock01Icon} className="size-5 text-primary" />
          <span className="text-xl font-bold text-white">
            {formatWatchHours(month.totalWatchMinutes)}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
            Watch Time
          </span>
        </div>
      </div>

      {month.episodes.length > 0 && (
        <section aria-label="Episodes watched">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
            <HugeiconsIcon icon={Tv01Icon} className="size-4 text-white/60" />
            Episodes Watched ({month.episodeCount})
          </h2>
          <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10 bg-white/5">
            {month.episodes.map((episode) => (
              <li
                key={`${episode.tvShowId}-${episode.seasonNumber}-${episode.episodeNumber}`}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">
                    {episode.tvShowName}
                  </div>
                  <div className="truncate text-xs text-white/50">
                    S{episode.seasonNumber} E{episode.episodeNumber}
                    {episode.episodeName ? ` · ${episode.episodeName}` : ""}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-white/60">
                  {formatWatchHours(episode.minutes)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {month.items.length > 0 && (
        <section aria-label="Added to Already Watched">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
            <HugeiconsIcon icon={Film01Icon} className="size-4 text-white/60" />
            Added to Already Watched ({month.alreadyWatchedCount})
          </h2>
          <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10 bg-white/5">
            {month.items.map((item) => (
              <li
                key={`${item.mediaType}-${item.mediaId}`}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">
                    {item.title}
                  </div>
                  <div className="truncate text-xs text-white/50">
                    {item.mediaType === "movie" ? "Movie" : "TV Show"}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-white/60">
                  {formatWatchHours(item.minutes)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

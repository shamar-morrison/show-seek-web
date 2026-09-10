"use client"

import { useAuth } from "@/context/auth-context"
import { useWatchTimeBackfill } from "@/hooks/use-watch-time-backfill"
import { useWatchTimeStats } from "@/hooks/use-watch-time-stats"
import { formatWatchHours } from "@/lib/format-watch-time"
import { cn } from "@/lib/utils"
import {
  ArrowRight01Icon,
  Clock01Icon,
  Film01Icon,
  StarIcon,
  Tv01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"
import type { ReactNode } from "react"

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-2 text-white/60">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
      {sub && <div className="mt-1 text-xs text-white/50">{sub}</div>}
    </div>
  )
}

/**
 * Stats client: last-6-months overview + monthly breakdown cards.
 * Fires the runtime backfill once on mount when entries lack measured
 * runtimes (stats-gated by design — nowhere else triggers it).
 */
export function StatsClient() {
  const { user } = useAuth()
  const userId = user && !user.isAnonymous ? user.uid : null
  const stats = useWatchTimeStats()

  useWatchTimeBackfill({
    userId,
    unstampedEpisodes: stats.unstampedEpisodes,
    unstampedListItems: stats.unstampedListItems,
    loading: stats.loading,
    enabled: true,
  })

  if (stats.loading) {
    return (
      <div className="space-y-8 pb-16" aria-label="Loading stats">
        <div className="h-32 animate-pulse rounded-xl bg-white/5" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      </div>
    )
  }

  const isEmpty =
    stats.episodeCount === 0 &&
    stats.alreadyWatchedCount === 0 &&
    stats.ratedCount === 0

  if (isEmpty) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center space-y-4 pb-16 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-yellow-500/10">
          <HugeiconsIcon
            icon={Clock01Icon}
            className="size-8 text-yellow-500"
          />
        </div>
        <h2 className="text-xl font-bold text-white">No watch history yet</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Mark episodes as watched or add movies and shows to your Already
          Watched list and your totals will show up here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-10 pb-16">
      {/* Last 6 Months Overview */}
      <section aria-label="Last 6 months overview">
        <h2 className="mb-4 text-xl font-bold text-white">
          Last 6 Months Overview
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<HugeiconsIcon icon={Clock01Icon} className="size-4" />}
            label="Total Hours Watched"
            value={formatWatchHours(stats.totalWatchMinutes)}
          />
          <StatCard
            icon={<HugeiconsIcon icon={Tv01Icon} className="size-4" />}
            label="Episodes Watched"
            value={String(stats.episodeCount)}
          />
          <StatCard
            icon={<HugeiconsIcon icon={Film01Icon} className="size-4" />}
            label="Added to Watched"
            value={String(stats.alreadyWatchedCount)}
          />
          <StatCard
            icon={<HugeiconsIcon icon={StarIcon} className="size-4" />}
            label="Rated"
            value={String(stats.ratedCount)}
          />
        </div>
      </section>

      {/* Monthly Breakdown */}
      <section aria-label="Monthly breakdown">
        <h2 className="mb-4 text-xl font-bold text-white">Monthly Breakdown</h2>
        {stats.months.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing in the last 6 months yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.months.map((month) => (
              <Link
                key={month.key}
                href={`/stats/${month.key}`}
                className={cn(
                  "group rounded-xl border border-white/10 bg-white/5 p-5",
                  "transition-colors hover:border-white/25 hover:bg-white/10",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">
                    {month.label}
                  </span>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="size-4 text-white/40 transition-transform group-hover:translate-x-0.5 group-hover:text-white"
                  />
                </div>
                <div className="mt-2 text-2xl font-bold text-white">
                  {formatWatchHours(month.totalWatchMinutes)}
                </div>
                <div className="mt-1 text-xs text-white/50">
                  {month.episodeCount}{" "}
                  {month.episodeCount === 1 ? "episode" : "episodes"} ·{" "}
                  {month.alreadyWatchedCount} added · {month.ratedCount}{" "}
                  rated
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

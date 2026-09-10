"use client"

import { useAuth } from "@/context/auth-context"
import { useGenreMap } from "@/hooks/use-genre-map"
import { useWatchTimeBackfill } from "@/hooks/use-watch-time-backfill"
import { useWatchTimeStats } from "@/hooks/use-watch-time-stats"
import { formatWatchHours } from "@/lib/format-watch-time"
import { cn } from "@/lib/utils"
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  Calendar03Icon,
  Clock01Icon,
  FireIcon,
  Medal01Icon,
  MinusSignIcon,
  PlusSignIcon,
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
 * Watched-count % change vs last month (mobile ComparisonBadge parity).
 * Hidden for the oldest month (comparison === null).
 */
function ComparisonBadge({ value }: { value: number | null }) {
  if (value === null) return null

  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-white/40">
        <HugeiconsIcon icon={MinusSignIcon} className="size-3" />
        No change vs last month
      </span>
    )
  }

  const isPositive = value > 0
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold",
        isPositive ? "text-[#46D369]" : "text-[#E50914]",
      )}
    >
      <HugeiconsIcon
        icon={isPositive ? ArrowUp01Icon : ArrowDown01Icon}
        className="size-3"
      />
      {isPositive ? `+${value}` : `${value}`}% vs last month
    </span>
  )
}

/**
 * Stats client: last-6-months overview, streaks, activity patterns, and
 * monthly breakdown cards. Fires the runtime backfill once on mount when
 * entries lack measured runtimes (stats-gated by design).
 */
export function StatsClient() {
  const { user } = useAuth()
  const userId = user && !user.isAnonymous ? user.uid : null
  const { data: genreMap } = useGenreMap()
  const stats = useWatchTimeStats({ genreMap })

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
            icon={<HugeiconsIcon icon={Tv01Icon} className="size-4 text-primary" />}
            label="Watched"
            value={String(stats.episodeCount + stats.alreadyWatchedCount)}
          />
          <StatCard
            icon={<HugeiconsIcon icon={StarIcon} className="size-4 text-[#F57C00]" />}
            label="Rated"
            value={String(stats.ratedCount)}
          />
          <StatCard
            icon={<HugeiconsIcon icon={PlusSignIcon} className="size-4 text-[#46D369]" />}
            label="Added"
            value={String(stats.totalAddedToLists)}
          />
          <StatCard
            icon={<HugeiconsIcon icon={Clock01Icon} className="size-4 text-primary" />}
            label="Total Hours Watched"
            value={formatWatchHours(stats.totalWatchMinutes)}
          />
        </div>
      </section>

      {/* Streaks */}
      <section aria-label="Streaks">
        <h2 className="mb-4 text-xl font-bold text-white">Streaks</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={FireIcon} className="size-7 text-[#FF6B35]" />
              <span className="text-2xl font-bold text-white">
                {stats.currentStreak}{" "}
                {stats.currentStreak === 1 ? "day" : "days"}
              </span>
            </div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-white/60">
              Current Streak
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Medal01Icon} className="size-7 text-[#FFD700]" />
              <span className="text-2xl font-bold text-white">
                {stats.longestStreak}{" "}
                {stats.longestStreak === 1 ? "day" : "days"}
              </span>
            </div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-white/60">
              Longest Streak
            </div>
          </div>
        </div>
      </section>

      {/* Activity Patterns */}
      {(stats.mostActiveDay || stats.mostActiveTimeOfDay) && (
        <section aria-label="Activity patterns">
          <h2 className="mb-4 text-xl font-bold text-white">
            Activity Patterns
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {stats.mostActiveDay && (
              <StatCard
                icon={
                  <HugeiconsIcon icon={Calendar03Icon} className="size-4 text-primary" />
                }
                label="Most Active Day"
                value={stats.mostActiveDay}
              />
            )}
            {stats.mostActiveTimeOfDay && (
              <StatCard
                icon={
                  <HugeiconsIcon icon={Clock01Icon} className="size-4 text-primary" />
                }
                label="Preferred Time"
                value={stats.mostActiveTimeOfDay}
              />
            )}
          </div>
        </section>
      )}

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
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-white">
                    {month.label}
                  </span>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="size-4 shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5 group-hover:text-white"
                  />
                </div>
                <div className="mt-1">
                  <ComparisonBadge
                    value={month.comparisonToPrevious?.watched ?? null}
                  />
                </div>
                <div className="mt-3 space-y-1.5 text-sm">
                  <div className="flex items-center gap-2 text-white/80">
                    <HugeiconsIcon icon={Tv01Icon} className="size-4 text-white/40" />
                    <span>
                      {month.watched} watched
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <HugeiconsIcon icon={StarIcon} className="size-4 text-[#F57C00]" />
                    <span>
                      {month.averageRating ?? "-"} avg rating
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <HugeiconsIcon icon={PlusSignIcon} className="size-4 text-[#46D369]" />
                    <span>
                      {month.addedToListsCount} added
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3 text-sm text-white/80">
                  <HugeiconsIcon icon={Clock01Icon} className="size-4 text-white/40" />
                  <span className="font-semibold text-white">
                    {formatWatchHours(month.totalWatchMinutes)}
                  </span>
                  <span className="text-xs text-white/50">Watch Time</span>
                </div>
                {month.topGenres.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/10 pt-3">
                    {month.topGenres.map((genre) => (
                      <span
                        key={genre}
                        className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/60"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

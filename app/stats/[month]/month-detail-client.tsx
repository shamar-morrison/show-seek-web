"use client"

import { useWatchTimeStats } from "@/hooks/use-watch-time-stats"
import { formatWatchHours } from "@/lib/format-watch-time"
import { cn } from "@/lib/utils"
import {
  ArrowLeft01Icon,
  Clock01Icon,
  PlusSignIcon,
  StarIcon,
  Tv01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"
import { useMemo, useState } from "react"

type DetailTab = "watched" | "rated" | "added"

function formatCount(count: number): string {
  return count > 99 ? "99+" : String(count)
}

function ratedHref(item: {
  mediaType: "movie" | "tv" | "episode" | "season"
  mediaId: string
  tvShowId?: number
}): string {
  if (item.mediaType === "movie") return `/movie/${item.mediaId}`
  if (item.mediaType === "tv") return `/tv/${item.mediaId}`
  if (item.tvShowId) return `/tv/${item.tvShowId}`
  return `/tv/${item.mediaId}`
}

/**
 * Month-detail drill-down with watched/rated/added tabs (mobile parity).
 * Reads the shared stats caches only — no backfill fires here by design
 * (see the route contract in page.tsx).
 */
export function MonthDetailClient({ monthKey }: { monthKey: string }) {
  const stats = useWatchTimeStats()
  const month = stats.months.find((m) => m.key === monthKey)

  const defaultTab: DetailTab = useMemo(() => {
    if (!month) return "watched"
    if (month.watched > 0) return "watched"
    if (month.ratedCount > 0) return "rated"
    return "added"
  }, [month])
  const [activeTab, setActiveTab] = useState<DetailTab | null>(null)
  const tab = activeTab ?? defaultTab

  // Episodes pre-grouped by show (mobile episode-group parity).
  const episodeGroups = useMemo(() => {
    if (!month) return []
    const groups = new Map<
      number,
      { tvShowId: number; tvShowName: string; count: number; minutes: number }
    >()
    for (const episode of month.episodes) {
      const group = groups.get(episode.tvShowId) ?? {
        tvShowId: episode.tvShowId,
        tvShowName: episode.tvShowName,
        count: 0,
        minutes: 0,
      }
      group.count += 1
      group.minutes += episode.minutes
      groups.set(episode.tvShowId, group)
    }
    return [...groups.values()].sort((a, b) => b.count - a.count)
  }, [month])

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

  const tabs: Array<{
    key: DetailTab
    label: string
    count: number
    icon: typeof Tv01Icon
    iconClassName: string
  }> = [
    {
      key: "watched",
      label: "Watched",
      count: month.watched,
      icon: Tv01Icon,
      iconClassName: "text-primary",
    },
    {
      key: "rated",
      label: "Rated",
      count: month.ratedCount,
      icon: StarIcon,
      iconClassName: "text-[#F57C00]",
    },
    {
      key: "added",
      label: "Added",
      count: month.addedToListsCount,
      icon: PlusSignIcon,
      iconClassName: "text-[#46D369]",
    },
  ]

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
      </div>

      {/* Summary card */}
      <section
        aria-label="Month summary"
        className="rounded-xl border border-white/10 bg-white/5 p-5"
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
              <HugeiconsIcon icon={Tv01Icon} className="size-4 text-primary" />
              Watched
            </div>
            <div className="mt-1 text-xl font-bold text-white">
              {month.watched}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
              <HugeiconsIcon icon={StarIcon} className="size-4 text-[#F57C00]" />
              Avg Rating
            </div>
            <div className="mt-1 text-xl font-bold text-white">
              {month.averageRating ?? "-"}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
              <HugeiconsIcon icon={PlusSignIcon} className="size-4 text-[#46D369]" />
              Added
            </div>
            <div className="mt-1 text-xl font-bold text-white">
              {month.addedToListsCount}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
              <HugeiconsIcon icon={Clock01Icon} className="size-4 text-primary" />
              Watch Time
            </div>
            <div className="mt-1 text-xl font-bold text-white">
              {formatWatchHours(month.totalWatchMinutes)}
            </div>
          </div>
        </div>
        {month.topGenres.length > 0 && (
          <div className="mt-4 border-t border-white/10 pt-3 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Top Genres{" "}
            </span>
            <span className="text-white/80">{month.topGenres.join(", ")}</span>
          </div>
        )}
      </section>

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Month detail tabs">
        {tabs.map((tabOption) => {
          const isActive = tab === tabOption.key
          return (
            <button
              key={tabOption.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tabOption.key)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                isActive
                  ? "bg-primary text-white"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white",
              )}
            >
              <HugeiconsIcon
                icon={tabOption.icon}
                className={cn(
                  "size-4",
                  isActive ? "text-white" : tabOption.iconClassName,
                )}
              />
              {tabOption.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs",
                  isActive
                    ? "bg-white text-primary"
                    : "bg-white/10 text-white/60",
                )}
              >
                {formatCount(tabOption.count)}
              </span>
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === "watched" && (
        <section aria-label="Watched">
          {month.watched === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nothing watched this month.
            </p>
          ) : (
            <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10 bg-white/5">
              {episodeGroups.map((group) => (
                <li key={`show-${group.tvShowId}`}>
                  <Link
                    href={`/tv/${group.tvShowId}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-white/5"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white">
                        {group.tvShowName}
                      </div>
                      <div className="truncate text-xs text-white/50">
                        {group.count}{" "}
                        {group.count === 1 ? "episode" : "episodes"}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-white/60">
                      {formatWatchHours(group.minutes)}
                    </span>
                  </Link>
                </li>
              ))}
              {month.items.map((item) => (
                <li key={`${item.mediaType}-${item.mediaId}`}>
                  <Link
                    href={`/${item.mediaType}/${item.mediaId}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-white/5"
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
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "rated" && (
        <section aria-label="Rated">
          {month.rated.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nothing rated this month.
            </p>
          ) : (
            <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10 bg-white/5">
              {month.rated.map((item) => (
                <li key={`${item.mediaType}-${item.mediaId}`}>
                  <Link
                    href={ratedHref(item)}
                    className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-white/5"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white">
                        {item.title}
                      </div>
                      <div className="truncate text-xs capitalize text-white/50">
                        {item.mediaType}
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-white">
                      <HugeiconsIcon
                        icon={StarIcon}
                        className="size-3.5 text-[#F57C00]"
                      />
                      {item.rating}/10
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "added" && (
        <section aria-label="Added">
          {month.added.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nothing added this month.
            </p>
          ) : (
            <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10 bg-white/5">
              {month.added.map((item) => (
                <li key={`${item.listId}-${item.itemKey}`}>
                  <Link
                    href={`/${item.mediaType}/${item.mediaId}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-white/5"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white">
                        {item.title}
                      </div>
                      <div className="truncate text-xs capitalize text-white/50">
                        {item.mediaType}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { FilterTabButton } from "@/components/ui/filter-tab-button"
import { useHistory } from "@/hooks/use-history"
import { formatWatchHours } from "@/lib/format-watch-time"
import type {
  ActivityItem,
  HistoryData,
  MediaSplit,
  MonthlyDetail,
  MonthlyStats,
  MonthWatchedItem,
} from "@/types/history"

type Tab = "watched" | "rated" | "added"

export function CategoryLedger({
  title,
  total,
  split,
}: {
  title: string
  total: number
  split: MediaSplit
}) {
  return (
    <div aria-label={`${title}: ${total}`} className="min-w-0">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-white">{title}</h3>
        <span className="text-2xl font-semibold tabular-nums text-white">
          {total.toLocaleString("en-US")}
        </span>
      </div>
      <dl className="divide-y divide-white/5 border-t border-white/10 text-sm">
        <div className="flex justify-between gap-2 py-2.5">
          <dt className="text-gray-400">Movies</dt>
          <dd className="tabular-nums text-gray-200">
            {split.movies.toLocaleString("en-US")}
          </dd>
        </div>
        <div className="flex justify-between gap-2 pt-2.5">
          <dt className="text-gray-400">
            TV Shows
            {split.tvEpisodes > 0 && (
              <span className="mt-1 block text-xs text-gray-500">
                {split.tvEpisodes.toLocaleString("en-US")}{" "}
                {split.tvEpisodes === 1 ? "episode" : "episodes"}
              </span>
            )}
          </dt>
          <dd className="tabular-nums text-gray-200">
            {split.tvShows.toLocaleString("en-US")}
          </dd>
        </div>
      </dl>
    </div>
  )
}
function Genres({ genres }: { genres: string[] }) {
  return genres.length > 0 ? (
    <p className="text-xs text-gray-400">
      <span className="sr-only">Top genres: </span>
      {genres.join(" · ")}
    </p>
  ) : null
}
function Summary({
  stats,
  overview = false,
}: {
  stats: MonthlyStats | HistoryData
  overview?: boolean
}) {
  const totals =
    "totalWatched" in stats
      ? [stats.totalWatched, stats.totalRated, stats.totalAddedToLists]
      : [stats.watched, stats.rated, stats.addedToLists]
  return (
    <div>
      <div className="grid gap-7 sm:grid-cols-3 sm:gap-10">
        <CategoryLedger
          title="Watched"
          total={totals[0]}
          split={stats.watchedSplit}
        />
        <CategoryLedger
          title="Rated"
          total={totals[1]}
          split={stats.ratedSplit}
        />
        <CategoryLedger
          title="Added"
          total={totals[2]}
          split={stats.addedSplit}
        />
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
        <div>
          <p className="text-xs text-gray-400">
            {overview ? "Total Hours" : "Watch Time"}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-white">
            {formatWatchHours(stats.totalWatchMinutes)}
          </p>
        </div>
        {"averageRating" in stats && (
          <div className="text-right">
            <p className="text-xs text-gray-400">Average Rating</p>
            <p className="mt-1 text-xl font-semibold text-white">
              {stats.averageRating ?? "—"}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
function MonthRow({ stats }: { stats: MonthlyStats }) {
  const change = stats.comparisonToPrevious?.watched
  return (
    <Link
      href={`/lists/stats/${stats.month}`}
      className="group block rounded-xl bg-white/[0.025] p-5 transition-colors hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-primary sm:p-6"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-white">
          {stats.monthName}
          <span
            aria-hidden="true"
            className="ml-2 inline-block text-gray-500 transition-transform group-hover:translate-x-1"
          >
            →
          </span>
        </h3>
        {change != null && (
          <span
            className={`text-xs ${change > 0 ? "text-emerald-400" : change < 0 ? "text-red-400" : "text-gray-500"}`}
          >
            {change === 0 ? "No change" : `${change > 0 ? "+" : ""}${change}%`}{" "}
            vs last month
          </span>
        )}
      </div>
      <Summary stats={stats} />
      <div className="mt-4">
        <Genres genres={stats.topGenres} />
      </div>
    </Link>
  )
}
export function StatsOverview({ data }: { data: HistoryData }) {
  if (!data.totalWatched && !data.totalRated && !data.totalAddedToLists)
    return (
      <EmptyState
        title="No activity yet"
        message="Watch a title, leave a rating, or add something to a list to start your history."
      />
    )
  return (
    <div className="space-y-10">
      <section aria-labelledby="overview-title">
        <h2
          id="overview-title"
          className="mb-6 text-xl font-semibold text-white"
        >
          Last 6 Months Overview
        </h2>
        <Summary stats={data} overview />
      </section>
      <div className="grid gap-8 border-y border-white/10 py-7 md:grid-cols-2">
        <section aria-labelledby="streaks-title">
          <h2
            id="streaks-title"
            className="mb-4 text-sm font-medium text-gray-400"
          >
            Streaks
          </h2>
          <dl className="grid grid-cols-2 gap-5">
            <Metric
              label="Current Streak"
              value={`${data.currentStreak} ${data.currentStreak === 1 ? "day" : "days"}`}
            />
            <Metric
              label="Longest Streak"
              value={`${data.longestStreak} ${data.longestStreak === 1 ? "day" : "days"}`}
            />
          </dl>
        </section>
        {(data.mostActiveDay || data.mostActiveTimeOfDay) && (
          <section aria-labelledby="patterns-title">
            <h2
              id="patterns-title"
              className="mb-4 text-sm font-medium text-gray-400"
            >
              Activity Patterns
            </h2>
            <dl className="grid grid-cols-2 gap-5">
              <Metric
                label="Most Active Day"
                value={data.mostActiveDay ?? "—"}
              />
              <Metric
                label="Preferred Time"
                value={data.mostActiveTimeOfDay ?? "—"}
              />
            </dl>
          </section>
        )}
      </div>
      <section aria-labelledby="months-title">
        <h2 id="months-title" className="mb-5 text-xl font-semibold text-white">
          Monthly Breakdown
        </h2>
        <div className="space-y-4">
          {data.monthlyStats.map((stats) => (
            <MonthRow key={stats.month} stats={stats} />
          ))}
        </div>
      </section>
    </div>
  )
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse gap-1">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-xl font-semibold text-white">{value}</dd>
    </div>
  )
}
function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="py-20 text-center">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">{message}</p>
    </div>
  )
}
export function activityHref(
  item: ActivityItem | MonthWatchedItem,
): string | null {
  if (item.mediaType === "episode" || item.mediaType === "season") {
    if (!item.tvShowId || !Number.isFinite(item.tvShowId)) return null
    if (item.mediaType === "season" && typeof item.seasonNumber === "number")
      return `/tv/${item.tvShowId}/season/${item.seasonNumber}`
    return `/tv/${item.tvShowId}`
  }
  const id = Number(item.id)
  return Number.isFinite(id) && id > 0 ? `/${item.mediaType}/${id}` : null
}
function ActivityRow({ item }: { item: ActivityItem | MonthWatchedItem }) {
  const href = activityHref(item)
  const subtitle =
    "kind" in item && item.kind === "episode-group"
      ? `${item.episodeCount} ${item.episodeCount === 1 ? "episode" : "episodes"}`
      : item.mediaType === "movie"
        ? "Movie"
        : item.mediaType === "tv"
          ? "TV Show"
          : `${"tvShowName" in item ? (item.tvShowName ?? "TV Show") : "TV Show"} · Season ${"seasonNumber" in item ? (item.seasonNumber ?? "—") : "—"}${item.mediaType === "episode" ? ` · Episode ${item.episodeNumber ?? "—"}` : ""}`
  const body = (
    <>
      <div className="relative aspect-2/3 w-12 shrink-0 overflow-hidden rounded-md bg-white/5 sm:w-14">
        {item.posterPath ? (
          <Image
            src={`https://image.tmdb.org/t/p/w185${item.posterPath}`}
            alt=""
            fill
            sizes="56px"
            className="object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-xs text-gray-600">
            —
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium text-white">
          {item.title}
        </h3>
        <p className="mt-1 truncate text-xs text-gray-400">{subtitle}</p>
        <p className="mt-2 text-xs text-gray-500">
          {new Date(item.timestamp).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>
      {"rating" in item && item.rating != null && (
        <span
          className="shrink-0 text-sm font-semibold text-white"
          aria-label={`Rating ${item.rating} out of 10`}
        >
          {item.rating}
          <span className="font-normal text-gray-500">/10</span>
        </span>
      )}
    </>
  )
  const className =
    "flex items-center gap-4 rounded-lg px-3 py-4 transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-primary"
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}
export function StatsMonthDetail({ data }: { data: MonthlyDetail }) {
  const added = data.items.added.filter(
    (item) => item.mediaType === "movie" || item.mediaType === "tv",
  )
  const [active, setSelected] = useState<Tab>(() =>
    data.items.watched.length
      ? "watched"
      : data.items.rated.length
        ? "rated"
        : added.length
          ? "added"
          : "watched",
  )
  const items = active === "added" ? added : data.items[active]
  if (!data.items.watched.length && !data.items.rated.length && !added.length)
    return (
      <EmptyState
        title="No activity this month"
        message="Your watched titles, ratings, and list additions for this month will appear here."
      />
    )
  const summary = {
    ...data.stats,
    addedToLists: added.length,
    addedSplit: {
      movies: added.filter((item) => item.mediaType === "movie").length,
      tvShows: added.filter((item) => item.mediaType === "tv").length,
      tvEpisodes: 0,
    },
  }
  return (
    <div>
      <Summary stats={summary} />
      <div className="mt-4">
        <Genres genres={data.stats.topGenres} />
      </div>
      <div
        aria-label="Activity categories"
        className="mt-8 flex gap-2 overflow-x-auto border-b border-white/10 pb-4"
      >
        {(["watched", "rated", "added"] as const).map((tab) => {
          // Mobile counts each watch, even when episodes render as one grouped row.
          const count =
            tab === "watched"
              ? data.stats.watched
              : tab === "rated"
                ? data.items.rated.length
                : added.length
          return (
            <FilterTabButton
              key={tab}
              label={tab[0].toUpperCase() + tab.slice(1)}
              count={count}
              isActive={active === tab}
              onClick={() => setSelected(tab)}
            />
          )
        })}
      </div>
      {items.length ? (
        <div className="mt-2 grid gap-x-8 sm:grid-cols-2">
          {items.map((item, index) => (
            <ActivityRow
              key={`${"kind" in item ? item.kind : item.type}-${item.mediaType}-${item.id}-${index}`}
              item={item}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={`Nothing ${active} this month`}
          message="Choose another activity category to explore this month."
        />
      )}
    </div>
  )
}
export function StatsClient({
  genres,
  month,
}: {
  genres: Record<number, string>
  month?: string
}) {
  const history = useHistory(genres, month)
  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex min-h-9 items-center justify-end gap-3">
        <span role="status" className="text-xs text-gray-400">
          {history.fetching
            ? "Updating stats…"
            : history.deferred
              ? "Refresh will resume shortly…"
              : history.cooldown > 0
                ? `Refresh available in ${history.cooldown}s`
                : ""}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void history.refresh()}
          disabled={history.loading || history.fetching || history.cooldown > 0}
        >
          {history.error ? "Retry" : "Refresh"}
        </Button>
      </div>
      {history.error && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-400/20 bg-red-400/5 p-4 text-sm text-gray-300"
        >
          Couldn’t update your stats.{" "}
          {history.overview
            ? "Showing your saved activity."
            : "Please try again."}
        </div>
      )}
      {history.loading ? (
        <div aria-label="Loading stats" className="space-y-6">
          <Skeleton className="h-7 w-60" />
          <div className="grid gap-6 sm:grid-cols-3">
            {[0, 1, 2].map((n) => (
              <Skeleton key={n} className="h-40 w-full" />
            ))}
          </div>
          <Skeleton className="h-24 w-full" />
        </div>
      ) : month && history.detail ? (
        <StatsMonthDetail key={month} data={history.detail} />
      ) : history.overview ? (
        <StatsOverview data={history.overview} />
      ) : null}
    </div>
  )
}

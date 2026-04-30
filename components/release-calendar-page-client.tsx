"use client"

import { PremiumModal } from "@/components/premium-modal"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  FilterSort,
  type FilterCategory,
  type MultiFilterState,
  type SortField,
  type SortState,
} from "@/components/ui/filter-sort"
import { FilterTabButton } from "@/components/ui/filter-tab-button"
import { ImageWithFallback } from "@/components/ui/image-with-fallback"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/context/auth-context"
import { usePosterOverrides } from "@/hooks/use-poster-overrides"
import { useReleaseCalendar } from "@/hooks/use-release-calendar"
import {
  ALL_DATES_TEMPORAL_TAB_KEY,
  CALENDAR_SOURCE_FILTERS,
  buildReleaseCalendarPresentations,
  filterReleaseCalendarRowsByTemporalTab,
  filterReleaseCalendarReleases,
  getCalendarDayOffset,
  getReleaseCalendarSources,
} from "@/lib/release-calendar-presentation"
import { isPremiumStatusPending } from "@/lib/premium-gating"
import { buildImageUrl } from "@/lib/tmdb"
import { cn } from "@/lib/utils"
import type {
  CalendarMediaFilter,
  CalendarSortMode,
  CalendarSourceFilter,
  ReleaseCalendarGroupedDisplayItem,
  ReleaseCalendarLabels,
  ReleaseCalendarPresentation,
  ReleaseCalendarRelease,
  ReleaseCalendarRow,
  ReleaseCalendarViewItem,
} from "@/types/release-calendar"
import {
  ArrangeIcon,
  Calendar03Icon,
  CrownIcon,
  Film01Icon,
  Loading03Icon,
  Tv01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"
import { useMemo, useState } from "react"

const PREVIEW_LIMIT = 3

type ReleaseCalendarSectionHeaderRow = Extract<
  ReleaseCalendarRow,
  { type: "section-header" }
>
type ReleaseCalendarCardRow = Extract<
  ReleaseCalendarRow,
  { type: "single-release" | "grouped-release" }
>

interface ReleaseCalendarRowSection {
  key: string
  header: ReleaseCalendarSectionHeaderRow | null
  cards: ReleaseCalendarCardRow[]
}

const MEDIA_TABS: Array<{
  key: CalendarMediaFilter
  label: string
  icon?: typeof Film01Icon
}> = [
  { key: "all", label: "All" },
  { key: "movie", label: "Movies", icon: Film01Icon },
  { key: "tv", label: "TV Shows", icon: Tv01Icon },
]

const SOURCE_FILTER_KEY = "source"

const SOURCE_LABELS: Record<CalendarSourceFilter, string> = {
  watchlist: "Watchlist",
  favorites: "Favorites",
  "currently-watching": "Watching",
}

const SOURCE_FILTER_CATEGORIES: FilterCategory[] = [
  {
    key: SOURCE_FILTER_KEY,
    label: "Sources",
    icon: ArrangeIcon,
    selectionMode: "multiple",
    options: CALENDAR_SOURCE_FILTERS.map((source) => ({
      value: source,
      label: SOURCE_LABELS[source],
    })),
  },
]

const SORT_FIELDS: SortField[] = [
  { value: "soonest", label: "Soonest" },
  { value: "alphabetical", label: "Alphabetical" },
  { value: "type", label: "By Type" },
]

function getReleaseHref(release: ReleaseCalendarViewItem): string {
  if (release.mediaType === "movie") {
    return `/movie/${release.id}`
  }

  if (release.nextEpisode) {
    return `/tv/${release.id}/season/${release.nextEpisode.seasonNumber}/episode/${release.nextEpisode.episodeNumber}`
  }

  return `/tv/${release.id}`
}

function formatCountdown(date: Date): string {
  const dayOffset = getCalendarDayOffset(date)

  if (dayOffset === 0) {
    return "Today"
  }

  if (dayOffset === 1) {
    return "Tomorrow"
  }

  return `In ${dayOffset} days`
}

function formatEpisodeDate(date: Date): string {
  const dayOffset = getCalendarDayOffset(date)

  if (dayOffset === 0) {
    return "Today"
  }

  if (dayOffset === 1) {
    return "Tomorrow"
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(date)
}

function ReleaseDateBadge({ date }: { date: Date }) {
  const isToday = getCalendarDayOffset(date) === 0

  return (
    <div
      className={cn(
        "absolute left-4 top-4 z-10 flex min-w-16 flex-col items-center rounded-2xl border px-3 py-2 text-center shadow-2xl backdrop-blur-md",
        isToday
          ? "border-primary bg-primary text-white"
          : "border-white/15 bg-black/70 text-white",
      )}
    >
      <span className="text-2xl font-semibold leading-none">
        {date.getDate()}
      </span>
      <span
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.2em]",
          isToday ? "text-white/80" : "text-white/55",
        )}
      >
        {date
          .toLocaleDateString(undefined, { month: "short" })
          .toLocaleUpperCase()}
      </span>
      {isToday ? (
        <span className="mt-1 rounded-full bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-primary">
          Today
        </span>
      ) : null}
    </div>
  )
}

function ReleaseArtwork({
  backdropPath,
  mediaId,
  mediaType,
  posterPath,
  title,
}: {
  backdropPath: string | null
  mediaId: number
  mediaType: "movie" | "tv"
  posterPath: string | null
  title: string
}) {
  const { resolvePosterPath } = usePosterOverrides()
  const resolvedPosterPath = resolvePosterPath(mediaType, mediaId, posterPath)
  const imageUrl =
    buildImageUrl(backdropPath, "w780") ??
    buildImageUrl(resolvedPosterPath, "w342")

  return (
    <div className="relative h-44 overflow-hidden bg-white/[0.04]">
      <ImageWithFallback
        src={imageUrl}
        alt={title}
        className="flex h-full w-full items-center justify-center bg-white/[0.04] px-4 text-center text-xs text-white/35"
        imageClassName="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        sizes="(max-width: 1024px) 100vw, (max-width: 1536px) 50vw, 33vw"
      />
      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/25 to-black/15" />
      {!imageUrl ? (
        <div className="absolute inset-0 flex items-center justify-center text-white/45">
          <HugeiconsIcon
            icon={mediaType === "movie" ? Film01Icon : Tv01Icon}
            className="size-8"
          />
        </div>
      ) : null}
    </div>
  )
}

function MediaTypeBadge({ mediaType }: { mediaType: "movie" | "tv" }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-white/70">
      <HugeiconsIcon
        icon={mediaType === "movie" ? Film01Icon : Tv01Icon}
        className="size-3.5"
      />
      {mediaType === "movie" ? "Movie" : "TV Show"}
    </span>
  )
}

function SourcePills({ sources }: { sources: CalendarSourceFilter[] }) {
  if (sources.length === 0) {
    return null
  }

  return (
    <>
      {sources.map((source) => (
        <span
          key={source}
          className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-white/52"
        >
          {SOURCE_LABELS[source]}
        </span>
      ))}
    </>
  )
}

function ReleaseMeta({ date, countdown }: { date: Date; countdown: string }) {
  return (
    <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/10 pt-4">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
        {countdown}
      </span>
      <span className="text-xs text-white/48">
        {date.toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          weekday: "short",
        })}
      </span>
    </div>
  )
}

function SingleReleaseCard({
  className,
  release,
}: {
  className?: string
  release: ReleaseCalendarViewItem
}) {
  return (
    <Link
      href={getReleaseHref(release)}
      data-testid="release-calendar-card"
      className={cn(
        "group flex h-full min-h-[360px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] transition-colors hover:border-white/20 hover:bg-white/[0.07]",
        className,
      )}
    >
      <div className="relative">
        <ReleaseArtwork
          backdropPath={release.backdropPath}
          mediaId={release.id}
          mediaType={release.mediaType}
          posterPath={release.posterPath}
          title={release.title}
        />
        <ReleaseDateBadge date={release.releaseDate} />
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <MediaTypeBadge mediaType={release.mediaType} />
          <SourcePills sources={getReleaseCalendarSources(release)} />
        </div>

        <div className="space-y-2">
          <h3 className="line-clamp-2 text-lg font-semibold text-white">
            {release.title}
          </h3>
          {release.nextEpisode ? (
            <div className="space-y-1">
              <p className="text-sm text-white/65">
                Season {release.nextEpisode.seasonNumber} Episode{" "}
                {release.nextEpisode.episodeNumber}
              </p>
              {release.nextEpisode.episodeName ? (
                <p className="line-clamp-2 text-sm text-white/88">
                  {release.nextEpisode.episodeName}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-white/65">
              {release.releaseDate.toLocaleDateString(undefined, {
                day: "numeric",
                month: "long",
                weekday: "long",
              })}
            </p>
          )}
        </div>

        <ReleaseMeta
          date={release.releaseDate}
          countdown={formatCountdown(release.releaseDate)}
        />
      </div>
    </Link>
  )
}

function GroupedReleaseCard({
  className,
  release,
}: {
  className?: string
  release: ReleaseCalendarGroupedDisplayItem
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const nextEpisode = release.episodes[0]?.nextEpisode
  const shouldShowEpisodeToggle = release.episodes.length > 1
  const visibleEpisodes =
    shouldShowEpisodeToggle && !isExpanded ? [] : release.episodes

  return (
    <div
      data-testid="release-calendar-card"
      className={cn(
        "group flex h-full min-h-[420px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04]",
        className,
      )}
    >
      <Link
        href={`/tv/${release.showId}`}
        className="group/header block transition-colors hover:bg-white/[0.03]"
      >
        <div className="relative">
          <ReleaseArtwork
            backdropPath={release.backdropPath}
            mediaId={release.showId}
            mediaType="tv"
            posterPath={release.posterPath}
            title={release.title}
          />
          <ReleaseDateBadge date={release.releaseDate} />
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <MediaTypeBadge mediaType="tv" />
            <SourcePills sources={release.sourceFilters} />
          </div>

          <div className="space-y-2">
            <h3 className="line-clamp-2 text-lg font-semibold text-white">
              {release.title}
            </h3>
            {nextEpisode ? (
              <p className="line-clamp-2 text-sm text-white/65">
                Season {nextEpisode.seasonNumber} Episode{" "}
                {nextEpisode.episodeNumber}
                {nextEpisode.episodeName ? ` / ${nextEpisode.episodeName}` : ""}
              </p>
            ) : null}
          </div>

          <ReleaseMeta
            date={release.releaseDate}
            countdown={formatCountdown(release.releaseDate)}
          />
        </div>
      </Link>

      <div className="mt-auto divide-y divide-white/10 border-t border-white/10 bg-black/25">
        {visibleEpisodes.map((episode) => (
          <Link
            key={episode.uniqueKey}
            href={getReleaseHref(episode)}
            className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-3 text-sm transition-colors hover:bg-white/[0.04]"
          >
            <div className="min-w-0 space-y-1">
              <p className="font-medium text-white/88">
                Season {episode.nextEpisode?.seasonNumber} Episode{" "}
                {episode.nextEpisode?.episodeNumber}
              </p>
              {episode.nextEpisode?.episodeName ? (
                <p className="truncate text-white/58">
                  {episode.nextEpisode.episodeName}
                </p>
              ) : null}
            </div>
            <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              {formatEpisodeDate(episode.releaseDate)}
            </span>
          </Link>
        ))}
        {shouldShowEpisodeToggle ? (
          <button
            type="button"
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((current) => !current)}
            className="w-full px-5 py-3 text-left text-sm font-semibold text-primary transition-colors hover:bg-white/[0.04]"
          >
            {isExpanded
              ? "Show less ↑"
              : `${release.episodes.length} episodes ↓`}
          </button>
        ) : null}
      </div>
    </div>
  )
}

function CalendarSkeleton() {
  return (
    <div data-testid="release-calendar-skeleton" className="space-y-6">
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-32 rounded-full" />
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-28 rounded-full" />
        ))}
      </div>

      <div
        data-testid="release-calendar-skeleton-grid"
        className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3"
      >
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            data-testid="release-calendar-skeleton-card"
            className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04]"
          >
            <div className="relative h-44 bg-white/[0.04]">
              <Skeleton className="h-full w-full rounded-none" />
              <div className="absolute left-4 top-4 space-y-2 rounded-2xl border border-white/10 bg-black/60 px-3 py-2">
                <Skeleton className="h-6 w-9 rounded-full" />
                <Skeleton className="h-3 w-10 rounded-full" />
              </div>
            </div>

            <div className="space-y-5 px-5 py-5">
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>

              <div className="space-y-2">
                <Skeleton className="h-6 w-2/3 rounded-full" />
                <Skeleton className="h-4 w-1/2 rounded-full" />
                <Skeleton className="h-4 w-1/3 rounded-full" />
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-4">
                <Skeleton className="h-4 w-24 rounded-full" />
                <Skeleton className="h-4 w-20 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface ReleaseCalendarViewProps {
  isLoading?: boolean
  isPremium: boolean
  isRefreshing?: boolean
  onUpgradeClick?: () => void
  releases: ReleaseCalendarRelease[]
}

function isCalendarSortMode(value: string): value is CalendarSortMode {
  return SORT_FIELDS.some((field) => field.value === value)
}

function normalizeSelectedSources(values: string[]): CalendarSourceFilter[] {
  const validSources = new Set<CalendarSourceFilter>(CALENDAR_SOURCE_FILTERS)

  return values.filter((value): value is CalendarSourceFilter =>
    validSources.has(value as CalendarSourceFilter),
  )
}

function buildReleaseCalendarRowSections(
  rows: ReleaseCalendarRow[],
): ReleaseCalendarRowSection[] {
  const sections: ReleaseCalendarRowSection[] = []
  let currentSection: ReleaseCalendarRowSection | null = null

  for (const row of rows) {
    if (row.type === "section-header") {
      currentSection = {
        key: row.key,
        header: row,
        cards: [],
      }
      sections.push(currentSection)
      continue
    }

    if (!currentSection) {
      currentSection = {
        key: "unsectioned-release-calendar-section",
        header: null,
        cards: [],
      }
      sections.push(currentSection)
    }

    currentSection.cards.push(row)
  }

  return sections
}

export function ReleaseCalendarView({
  isLoading = false,
  isPremium,
  isRefreshing = false,
  onUpgradeClick,
  releases,
}: ReleaseCalendarViewProps) {
  const [mediaFilter, setMediaFilter] = useState<CalendarMediaFilter>("all")
  const [selectedSources, setSelectedSources] = useState<
    CalendarSourceFilter[]
  >([...CALENDAR_SOURCE_FILTERS])
  const [sortMode, setSortMode] = useState<CalendarSortMode>("soonest")
  const [temporalFilter, setTemporalFilter] = useState<string>(
    ALL_DATES_TEMPORAL_TAB_KEY,
  )

  const labels = useMemo<ReleaseCalendarLabels>(
    () => ({
      today: "Today",
      tomorrow: "Tomorrow",
      thisWeek: "This Week",
      nextWeek: "Next Week",
      movies: "Movies",
      tvShows: "TV Shows",
    }),
    [],
  )
  const previewLimit = isPremium ? undefined : PREVIEW_LIMIT

  const sourceFilteredReleases = useMemo(
    () =>
      filterReleaseCalendarReleases(releases, {
        mediaFilter: "all",
        selectedSources,
      }),
    [releases, selectedSources],
  )

  const presentations = useMemo(
    () =>
      buildReleaseCalendarPresentations({
        labels,
        previewLimit,
        releases: sourceFilteredReleases,
        sortMode,
      }),
    [labels, previewLimit, sortMode, sourceFilteredReleases],
  )

  const activePresentation = presentations[mediaFilter]
  const temporalTabs =
    activePresentation.temporalTabs.length > 0
      ? [
          { key: ALL_DATES_TEMPORAL_TAB_KEY, label: "All dates" },
          ...activePresentation.temporalTabs,
        ]
      : []
  const activeTemporalTab = temporalTabs.some(
    (tab) => tab.key === temporalFilter,
  )
    ? temporalFilter
    : ALL_DATES_TEMPORAL_TAB_KEY
  const visibleRows = useMemo(
    () =>
      filterReleaseCalendarRowsByTemporalTab(
        activePresentation.rows,
        activeTemporalTab,
      ),
    [activePresentation.rows, activeTemporalTab],
  )
  const visibleSections = useMemo(
    () => buildReleaseCalendarRowSections(visibleRows),
    [visibleRows],
  )

  const hasReleases = releases.length > 0
  const isPreviewing = !isPremium
  const showUpgradeFooter =
    isPreviewing && activePresentation.totalContentCount > PREVIEW_LIMIT
  const resetCalendarControls = () => {
    setMediaFilter("all")
    setSelectedSources([...CALENDAR_SOURCE_FILTERS])
    setSortMode("soonest")
    setTemporalFilter(ALL_DATES_TEMPORAL_TAB_KEY)
  }

  if (isLoading) {
    return <CalendarSkeleton />
  }

  if (!hasReleases && isRefreshing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-white/45">
          <HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin" />
          <span>Updating TV episodes...</span>
        </div>
        <CalendarSkeleton />
      </div>
    )
  }

  if (!hasReleases) {
    return (
      <Empty className="min-h-[420px] rounded-[32px] border border-white/10 bg-white/[0.03]">
        <EmptyMedia variant="icon" className="bg-primary/15 text-primary">
          <HugeiconsIcon icon={Calendar03Icon} className="size-7" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle className="text-white">
            No upcoming releases found
          </EmptyTitle>
          <EmptyDescription className="text-white/60">
            Add shows or movies to your Watchlist, Favorites, or Watching list
            to see upcoming releases here.
          </EmptyDescription>
        </EmptyHeader>
        <Button asChild size="lg">
          <Link href="/lists/watch-lists">Go to Watch Lists</Link>
        </Button>
      </Empty>
    )
  }

  if (activePresentation.totalContentCount === 0) {
    return (
      <div className="space-y-6">
        <CalendarToolbar
          mediaFilter={mediaFilter}
          onClearAll={resetCalendarControls}
          onSelectMediaFilter={setMediaFilter}
          onSelectSources={setSelectedSources}
          onSelectSortMode={setSortMode}
          presentations={presentations}
          selectedSources={selectedSources}
          sortMode={sortMode}
        />

        <Empty className="min-h-[320px] border border-white/10 bg-black/20">
          <EmptyMedia variant="icon" className="bg-primary/15 text-primary">
            <HugeiconsIcon icon={ArrangeIcon} className="size-7" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-white">
              No releases match these filters
            </EmptyTitle>
            <EmptyDescription className="text-white/60">
              Try adjusting your source, media, or sort filters.
            </EmptyDescription>
          </EmptyHeader>
          <Button type="button" size="lg" onClick={resetCalendarControls}>
            Clear Filters
          </Button>
        </Empty>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <CalendarToolbar
        mediaFilter={mediaFilter}
        onClearAll={resetCalendarControls}
        onSelectMediaFilter={setMediaFilter}
        onSelectSources={setSelectedSources}
        onSelectSortMode={setSortMode}
        presentations={presentations}
        selectedSources={selectedSources}
        sortMode={sortMode}
      />

      {(isRefreshing || isPreviewing) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {isRefreshing ? (
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-white/45">
              <HugeiconsIcon
                icon={Loading03Icon}
                className="size-4 animate-spin"
              />
              <span>Updating TV episodes...</span>
            </div>
          ) : (
            <div />
          )}

          {isPreviewing ? (
            <div className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
              Previewing first {PREVIEW_LIMIT}
            </div>
          ) : null}
        </div>
      )}

      {temporalTabs.length > 0 ? (
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex min-w-max gap-2">
            {temporalTabs.map((tab) => (
              <FilterTabButton
                key={tab.key}
                isActive={activeTemporalTab === tab.key}
                label={tab.label}
                onClick={() => setTemporalFilter(tab.key)}
                testId={`release-calendar-temporal-tab-${tab.key}`}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div data-testid="release-calendar-card-grid" className="space-y-6">
        {visibleSections.map((section) => (
          <ReleaseCalendarSectionView key={section.key} section={section} />
        ))}
      </div>

      {showUpgradeFooter ? (
        <div
          data-testid="release-calendar-upgrade-cta"
          className="overflow-hidden rounded-[28px] border border-amber-500/20 bg-linear-to-br from-amber-500/14 via-orange-500/10 to-transparent p-6 sm:p-8"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-400">
                <HugeiconsIcon icon={CrownIcon} className="size-5" />
                <span className="text-sm font-semibold uppercase tracking-[0.18em]">
                  Premium
                </span>
              </div>
              <h2 className="text-2xl font-semibold text-white">
                Unlock the full release calendar
              </h2>
              <p className="max-w-2xl text-sm text-white/65">
                See every upcoming release from your tracked lists instead of
                just the first {PREVIEW_LIMIT}.
              </p>
            </div>

            <Button
              type="button"
              size="lg"
              data-testid="release-calendar-upgrade-button"
              onClick={onUpgradeClick}
            >
              Upgrade to Premium
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function CalendarToolbar({
  mediaFilter,
  onClearAll,
  onSelectMediaFilter,
  onSelectSources,
  onSelectSortMode,
  presentations,
  selectedSources,
  sortMode,
}: {
  mediaFilter: CalendarMediaFilter
  onClearAll: () => void
  onSelectMediaFilter: (filter: CalendarMediaFilter) => void
  onSelectSources: (sources: CalendarSourceFilter[]) => void
  onSelectSortMode: (sortMode: CalendarSortMode) => void
  presentations: Record<CalendarMediaFilter, ReleaseCalendarPresentation>
  selectedSources: CalendarSourceFilter[]
  sortMode: CalendarSortMode
}) {
  const multiFilterState: MultiFilterState = {
    [SOURCE_FILTER_KEY]: selectedSources,
  }
  const sortState: SortState = {
    field: sortMode,
    direction: "asc",
  }
  const hasActiveControls =
    sortMode !== "soonest" ||
    selectedSources.length !== CALENDAR_SOURCE_FILTERS.length

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex min-w-max gap-2">
          {MEDIA_TABS.map((tab) => (
            <FilterTabButton
              key={tab.key}
              count={presentations[tab.key].totalContentCount}
              icon={tab.icon}
              isActive={mediaFilter === tab.key}
              label={tab.label}
              onClick={() => onSelectMediaFilter(tab.key)}
              testId={`release-calendar-media-tab-${tab.key}`}
            />
          ))}
        </div>
      </div>

      <FilterSort
        filters={SOURCE_FILTER_CATEGORIES}
        filterState={{}}
        multiFilterState={multiFilterState}
        onFilterChange={() => undefined}
        onMultiFilterChange={(key, values) => {
          if (key === SOURCE_FILTER_KEY) {
            onSelectSources(normalizeSelectedSources(values))
          }
        }}
        sortFields={SORT_FIELDS}
        sortState={sortState}
        onSortChange={(state) => {
          if (isCalendarSortMode(state.field)) {
            onSelectSortMode(state.field)
          }
        }}
        onClearAll={onClearAll}
        showClearAll={hasActiveControls}
        showSortDirection={false}
        triggerLabel="Filter / Sort"
        triggerTestId="release-calendar-filter-sort-button"
        triggerClassName="h-11 rounded-full border-white/10 bg-white/[0.04] px-4 text-white hover:bg-white/[0.08]"
        className="border-white/10 bg-black text-white"
      />
    </div>
  )
}

function ReleaseCalendarSectionView({
  section,
}: {
  section: ReleaseCalendarRowSection
}) {
  return (
    <div className="space-y-4">
      {section.header ? (
        <ReleaseCalendarSectionHeader row={section.header} />
      ) : null}

      {section.cards.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {section.cards.map((row, index) => (
            <ReleaseCalendarCardRowView
              key={row.key}
              row={row}
              className={
                index === section.cards.length - 1 &&
                section.cards.length % 2 !== 0
                  ? "lg:col-span-2"
                  : ""
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ReleaseCalendarSectionHeader({
  row,
}: {
  row: ReleaseCalendarSectionHeaderRow
}) {
  return (
    <div className="flex items-center gap-3 pb-1 pt-4">
      <HugeiconsIcon icon={Calendar03Icon} className="size-5 text-primary" />
      <h2 className="text-xl font-semibold text-white">{row.title}</h2>
    </div>
  )
}

function ReleaseCalendarCardRowView({
  className,
  row,
}: {
  className?: string
  row: ReleaseCalendarCardRow
}) {
  if (row.type === "grouped-release") {
    return <GroupedReleaseCard release={row.item} className={className} />
  }

  return <SingleReleaseCard release={row.item.release} className={className} />
}

export function ReleaseCalendarPageClient() {
  const { isPremium, premiumLoading, premiumStatus } = useAuth()
  const { releases, isBootstrapping, isRefreshing, error } =
    useReleaseCalendar()
  const [showPremiumModal, setShowPremiumModal] = useState(false)

  const isPremiumPending = isPremiumStatusPending({
    premiumLoading,
    premiumStatus,
  })
  const canViewFullCalendar = !isPremiumPending && isPremium

  if (isBootstrapping) {
    return <ReleaseCalendarView releases={[]} isLoading isPremium={false} />
  }

  if (error) {
    return (
      <Empty className="min-h-[420px] rounded-[32px] border border-white/10 bg-white/[0.03]">
        <EmptyMedia variant="icon" className="bg-primary/15 text-primary">
          <HugeiconsIcon icon={Calendar03Icon} className="size-7" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle className="text-white">
            Couldn&apos;t load your release calendar
          </EmptyTitle>
          <EmptyDescription className="text-white/60">
            Refresh the page and try again.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <>
      <ReleaseCalendarView
        releases={releases}
        isPremium={canViewFullCalendar}
        isRefreshing={isRefreshing}
        onUpgradeClick={() => setShowPremiumModal(true)}
      />

      <PremiumModal
        open={showPremiumModal}
        onOpenChange={setShowPremiumModal}
      />
    </>
  )
}

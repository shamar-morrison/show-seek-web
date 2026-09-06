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
import { useUrlStateSync } from "@/hooks/use-url-state-sync"
import {
  ALL_DATES_TEMPORAL_TAB_KEY,
  CALENDAR_SOURCE_FILTERS,
  buildReleaseCalendarPresentations,
  filterReleaseCalendarRowsByTemporalTab,
  filterReleaseCalendarReleases,
  getCalendarDayOffset,
} from "@/lib/release-calendar-presentation"
import { isPremiumStatusPending } from "@/lib/premium-gating"
import { buildImageUrl } from "@/lib/tmdb"
import { cn } from "@/lib/utils"
import type {
  CalendarMediaFilter,
  CalendarSortMode,
  CalendarSourceFilter,
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
import { useEffect, useMemo, useState } from "react"

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

interface ReleaseCalendarUrlState {
  mediaFilter: CalendarMediaFilter
  selectedSources: CalendarSourceFilter[]
  sortMode: CalendarSortMode
  temporalFilter: string
}

function isCalendarMediaFilter(value: string | null): value is CalendarMediaFilter {
  return value === "all" || value === "movie" || value === "tv"
}

function isCalendarSortMode(value: string): value is CalendarSortMode {
  return SORT_FIELDS.some((field) => field.value === value)
}

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

interface FlatReleaseCard {
  key: string
  href: string
  title: string
  detail: string
  countdown: string
  date: Date
  posterPath: string | null
  mediaId: number
  mediaType: "movie" | "tv"
}

/**
 * Expand section rows into one flat card per release/episode.
 * Grouped same-show episodes become individual cards.
 */
function flattenSectionCards(
  cards: ReleaseCalendarCardRow[],
): FlatReleaseCard[] {
  const flat: FlatReleaseCard[] = []

  for (const row of cards) {
    if (row.type === "single-release") {
      const release = row.item.release
      flat.push({
        key: row.key,
        href: getReleaseHref(release),
        title: release.title,
        detail: release.releaseDate.toLocaleDateString(undefined, {
          day: "numeric",
          month: "long",
          weekday: "long",
        }),
        countdown: formatCountdown(release.releaseDate),
        date: release.releaseDate,
        posterPath: release.posterPath,
        mediaId: release.id,
        mediaType: release.mediaType,
      })
    } else {
      for (const episode of row.item.episodes) {
        const nextEpisode = episode.nextEpisode
        flat.push({
          key: episode.uniqueKey,
          href: getReleaseHref(episode),
          title: row.item.title,
          detail: nextEpisode
            ? `S${nextEpisode.seasonNumber} E${nextEpisode.episodeNumber}${
                nextEpisode.episodeName ? ` · ${nextEpisode.episodeName}` : ""
              }`
            : "",
          countdown: formatCountdown(episode.releaseDate),
          date: episode.releaseDate,
          posterPath: row.item.posterPath,
          mediaId: row.item.showId,
          mediaType: "tv",
        })
      }
    }
  }

  return flat
}

function CompactReleaseCard({ card }: { card: FlatReleaseCard }) {
  const { resolvePosterPath } = usePosterOverrides()
  const posterUrl = buildImageUrl(
    resolvePosterPath(card.mediaType, card.mediaId, card.posterPath),
    "w342",
  )
  const isToday = getCalendarDayOffset(card.date) === 0

  return (
    <Link
      href={card.href}
      data-testid="release-calendar-card"
      className="group flex flex-col gap-2"
    >
      <div className="relative aspect-2/3 w-full overflow-hidden rounded-xl bg-white/[0.04]">
        {posterUrl ? (
          <ImageWithFallback
            src={posterUrl}
            alt={card.title}
            className="flex h-full w-full items-center justify-center"
            imageClassName="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1536px) 20vw, 15vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/45">
            <HugeiconsIcon
              icon={card.mediaType === "movie" ? Film01Icon : Tv01Icon}
              className="size-8"
            />
          </div>
        )}
        <div
          className={cn(
            "absolute left-2 top-2 z-10 flex min-w-11 flex-col items-center rounded-xl border px-2 py-1.5 text-center shadow-xl backdrop-blur-md",
            isToday
              ? "border-primary bg-primary text-white"
              : "border-white/15 bg-black/70 text-white",
          )}
        >
          <span className="text-lg font-semibold leading-none">
            {card.date.getDate()}
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/60">
            {card.date
              .toLocaleDateString(undefined, { month: "short" })
              .toLocaleUpperCase()}
          </span>
        </div>
      </div>

      <div className="space-y-0.5 px-0.5">
        <h3 className="line-clamp-1 text-sm font-semibold text-white">
          {card.title}
        </h3>
        <p className="line-clamp-1 text-xs text-white/60">{card.detail}</p>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          {card.countdown}
        </p>
      </div>
    </Link>
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
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      >
        {Array.from({ length: 12 }).map((_, index) => (
          <div
            key={index}
            data-testid="release-calendar-skeleton-card"
            className="flex flex-col gap-2"
          >
            <Skeleton className="aspect-2/3 w-full rounded-xl" />

            <div className="space-y-1.5 px-0.5">
              <Skeleton className="h-4 w-3/4 rounded-full" />
              <Skeleton className="h-3 w-1/2 rounded-full" />
              <Skeleton className="h-3 w-1/3 rounded-full" />
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

function normalizeSelectedSources(values: string[]): CalendarSourceFilter[] {
  return CALENDAR_SOURCE_FILTERS.filter((source) =>
    values.includes(source),
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
  const [urlState, setUrlState] = useUrlStateSync<ReleaseCalendarUrlState>({
    keys: ["media", "source", "sort", "temporal"],
    parse: (params) => {
      const media = params.get("media")
      const sort = params.get("sort")
      const sortMode: CalendarSortMode = isCalendarSortMode(sort ?? "")
        ? ((sort ?? "soonest") as CalendarSortMode)
        : "soonest"
      const rawSources = params.getAll("source")
      const normalizedSources = normalizeSelectedSources(rawSources)
      const hasExplicitEmptySources = rawSources.some((source) => source === "")
      const selectedSources =
        rawSources.length === 0
          ? [...CALENDAR_SOURCE_FILTERS]
          : hasExplicitEmptySources && normalizedSources.length === 0
            ? []
            : normalizedSources.length > 0
              ? normalizedSources
              : [...CALENDAR_SOURCE_FILTERS]

      return {
        mediaFilter: isCalendarMediaFilter(media) ? media : "all",
        selectedSources,
        sortMode,
        temporalFilter:
          params.get("temporal")?.trim() || ALL_DATES_TEMPORAL_TAB_KEY,
      }
    },
    serialize: (state) => {
      const params = new URLSearchParams()

      if (state.mediaFilter !== "all") {
        params.set("media", state.mediaFilter)
      }

      if (state.selectedSources.length === 0) {
        params.append("source", "")
      } else if (state.selectedSources.length !== CALENDAR_SOURCE_FILTERS.length) {
        state.selectedSources.forEach((source) => params.append("source", source))
      }

      if (state.sortMode !== "soonest") {
        params.set("sort", state.sortMode)
      }

      if (state.temporalFilter !== ALL_DATES_TEMPORAL_TAB_KEY) {
        params.set("temporal", state.temporalFilter)
      }

      return params
    },
  })
  const mediaFilter = urlState.mediaFilter
  const selectedSources = urlState.selectedSources
  const sortMode = urlState.sortMode
  const temporalFilter = urlState.temporalFilter

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

  useEffect(() => {
    if (activeTemporalTab !== temporalFilter) {
      setUrlState((currentState) => ({
        ...currentState,
        temporalFilter: activeTemporalTab,
      }))
    }
  }, [activeTemporalTab, setUrlState, temporalFilter])

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

  // Flatten grouped episodes into individual cards. The lib already limited
  // grouped entries to PREVIEW_LIMIT for free users, so cap the flattened
  // cards too — otherwise one group could leak past the preview paywall.
  const displaySections = useMemo(() => {
    let remaining = isPreviewing ? PREVIEW_LIMIT : Number.POSITIVE_INFINITY
    const display: Array<{
      key: string
      header: ReleaseCalendarSectionHeaderRow | null
      flatCards: FlatReleaseCard[]
    }> = []

    for (const section of visibleSections) {
      if (remaining <= 0) break
      const flatCards = flattenSectionCards(section.cards).slice(0, remaining)
      remaining -= flatCards.length
      if (flatCards.length > 0) {
        display.push({ key: section.key, header: section.header, flatCards })
      }
    }

    return display
  }, [visibleSections, isPreviewing])
  const resetCalendarControls = () => {
    setUrlState({
      mediaFilter: "all",
      selectedSources: [...CALENDAR_SOURCE_FILTERS],
      sortMode: "soonest",
      temporalFilter: ALL_DATES_TEMPORAL_TAB_KEY,
    })
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
          onSelectMediaFilter={(nextMediaFilter) =>
            setUrlState((currentState) => ({
              ...currentState,
              mediaFilter: nextMediaFilter,
            }))
          }
          onSelectSources={(nextSelectedSources) =>
            setUrlState((currentState) => ({
              ...currentState,
              selectedSources: nextSelectedSources,
            }))
          }
          onSelectSortMode={(nextSortMode) =>
            setUrlState((currentState) => ({
              ...currentState,
              sortMode: nextSortMode,
            }))
          }
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
        onSelectMediaFilter={(nextMediaFilter) =>
          setUrlState((currentState) => ({
            ...currentState,
            mediaFilter: nextMediaFilter,
          }))
        }
        onSelectSources={(nextSelectedSources) =>
          setUrlState((currentState) => ({
            ...currentState,
            selectedSources: nextSelectedSources,
          }))
        }
        onSelectSortMode={(nextSortMode) =>
          setUrlState((currentState) => ({
            ...currentState,
            sortMode: nextSortMode,
          }))
        }
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
                onClick={() =>
                  setUrlState((currentState) => ({
                    ...currentState,
                    temporalFilter: tab.key,
                  }))
                }
                testId={`release-calendar-temporal-tab-${tab.key}`}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div data-testid="release-calendar-card-grid" className="space-y-6">
        {displaySections.map((section) => (
          <ReleaseCalendarSectionView
            key={section.key}
            header={section.header}
            flatCards={section.flatCards}
          />
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
  flatCards,
  header,
}: {
  flatCards: FlatReleaseCard[]
  header: ReleaseCalendarSectionHeaderRow | null
}) {
  return (
    <div className="space-y-4">
      {header ? <ReleaseCalendarSectionHeader row={header} /> : null}

      {flatCards.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {flatCards.map((card) => (
            <CompactReleaseCard key={card.key} card={card} />
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

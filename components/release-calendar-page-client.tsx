"use client"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { ImageWithFallback } from "@/components/ui/image-with-fallback"
import { Skeleton } from "@/components/ui/skeleton"
import { PremiumModal } from "@/components/premium-modal"
import { useAuth } from "@/context/auth-context"
import { useReleaseCalendar } from "@/hooks/use-release-calendar"
import { buildImageUrl } from "@/lib/tmdb"
import { parseTmdbDate, toLocalDateKey } from "@/lib/tmdb-date"
import {
  isPremiumStatusPending,
} from "@/lib/premium-gating"
import type {
  ReleaseCalendarRelease,
  ReleaseCalendarSection,
  ReleaseCalendarViewItem,
} from "@/types/release-calendar"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Calendar03Icon,
  CrownIcon,
  Film01Icon,
  Loading03Icon,
  Tv01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

const PREVIEW_LIMIT = 3
const DATE_STRIP_SCROLL_PERCENTAGE = 0.8

function toViewItem(release: ReleaseCalendarRelease): ReleaseCalendarViewItem {
  return {
    ...release,
    releaseDate: parseTmdbDate(release.releaseDate),
  }
}

function formatMonthHeading(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(date)
}

function getDateLabel(date: Date): string {
  const todayKey = toLocalDateKey(new Date())
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = toLocalDateKey(tomorrow)
  const dateKey = toLocalDateKey(date)

  if (dateKey === todayKey) {
    return "Today"
  }

  if (dateKey === tomorrowKey) {
    return "Tomorrow"
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date)
}

function formatCountdown(date: Date): string {
  const today = parseTmdbDate(toLocalDateKey(new Date()))
  const diffInDays = Math.round(
    (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )

  if (diffInDays <= 0) {
    return "Today"
  }

  if (diffInDays === 1) {
    return "Tomorrow"
  }

  return `In ${diffInDays} days`
}

function groupReleaseSections(
  releases: ReleaseCalendarRelease[],
): ReleaseCalendarSection[] {
  const sections = new Map<string, ReleaseCalendarViewItem[]>()

  for (const release of releases) {
    const viewItem = toViewItem(release)
    const monthHeading = formatMonthHeading(viewItem.releaseDate)
    const existingItems = sections.get(monthHeading)

    if (existingItems) {
      existingItems.push(viewItem)
      continue
    }

    sections.set(monthHeading, [viewItem])
  }

  return [...sections.entries()].map(([title, data]) => ({ title, data }))
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

function getSourceListLabel(sourceList: string): string {
  if (sourceList === "currently-watching") {
    return "Watching"
  }

  if (sourceList === "watchlist") {
    return "Watchlist"
  }

  return "Favorites"
}

interface DateStripProps {
  dates: Date[]
  selectedDateKey: string | null
  onSelectDate: (dateKey: string) => void
}

function DateStrip({ dates, selectedDateKey, onSelectDate }: DateStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [hasOverflow, setHasOverflow] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const container = scrollRef.current
    if (!container) {
      return
    }

    const threshold = 2
    const nextHasOverflow = container.scrollWidth > container.clientWidth + threshold

    setHasOverflow(nextHasOverflow)
    setCanScrollLeft(nextHasOverflow && container.scrollLeft > threshold)
    setCanScrollRight(
      nextHasOverflow &&
        container.scrollLeft < container.scrollWidth - container.clientWidth - threshold,
    )
  }, [])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) {
      return
    }

    updateScrollState()

    container.addEventListener("scroll", updateScrollState, { passive: true })

    let resizeObserver: ResizeObserver | undefined
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateScrollState)
      resizeObserver.observe(container)
    }

    return () => {
      container.removeEventListener("scroll", updateScrollState)
      resizeObserver?.disconnect()
    }
  }, [dates.length, updateScrollState])

  const scroll = useCallback((direction: "left" | "right") => {
    const container = scrollRef.current
    if (!container) {
      return
    }

    const scrollAmount = container.clientWidth * DATE_STRIP_SCROLL_PERCENTAGE
    const nextLeft =
      direction === "left"
        ? container.scrollLeft - scrollAmount
        : container.scrollLeft + scrollAmount

    container.scrollTo({
      left: nextLeft,
      behavior: "smooth",
    })
  }, [])

  const handleChipKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return
      }

      event.preventDefault()
      const nextIndex = event.key === "ArrowRight" ? index + 1 : index - 1
      const nextChip = chipRefs.current[nextIndex]

      if (!nextChip) {
        return
      }

      nextChip.focus()
      nextChip.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      })
    },
    [],
  )

  return (
    <div className="relative flex items-center gap-3">
      {hasOverflow ? (
        <button
          type="button"
          data-testid="release-calendar-scroll-left"
          aria-label="Scroll dates left"
          disabled={!canScrollLeft}
          onClick={() => scroll("left")}
          className="flex size-10 shrink-0 self-center items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/75 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" />
        </button>
      ) : null}

      <div
        ref={scrollRef}
        data-testid="release-calendar-date-strip"
        className="min-w-0 flex-1 overflow-x-auto scrollbar-hide"
      >
        <div className="flex gap-3 pr-1">
          {dates.map((date, index) => {
            const dateKey = toLocalDateKey(date)
            const isSelected = selectedDateKey === dateKey

            return (
              <button
                key={dateKey}
                ref={(node) => {
                  chipRefs.current[index] = node
                }}
                type="button"
                aria-pressed={isSelected}
                data-testid={`release-calendar-date-${dateKey}`}
                onKeyDown={(event) => handleChipKeyDown(event, index)}
                onClick={() => onSelectDate(dateKey)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  isSelected
                    ? "border-primary bg-primary text-white"
                    : "border-white/10 bg-white/[0.04] text-white/75 hover:border-white/20 hover:bg-white/[0.08]"
                }`}
              >
                {getDateLabel(date)}
              </button>
            )
          })}
        </div>
      </div>

      {hasOverflow ? (
        <button
          type="button"
          data-testid="release-calendar-scroll-right"
          aria-label="Scroll dates right"
          disabled={!canScrollRight}
          onClick={() => scroll("right")}
          className="flex size-10 shrink-0 self-center items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/75 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
        >
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-5" />
        </button>
      ) : null}
    </div>
  )
}

function ReleaseCard({ release }: { release: ReleaseCalendarViewItem }) {
  const imageUrl =
    buildImageUrl(release.posterPath, "w342") ??
    buildImageUrl(release.backdropPath, "w300")
  const isToday = toLocalDateKey(release.releaseDate) === toLocalDateKey(new Date())
  const formattedReleaseDate = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(release.releaseDate)

  return (
    <Link
      href={getReleaseHref(release)}
      className="group flex h-full min-h-[184px] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition-colors hover:border-white/20 hover:bg-white/[0.06]"
    >
      <div
        className={`flex w-16 shrink-0 flex-col items-center justify-center border-r border-white/10 px-2 py-4 text-center ${
          isToday ? "bg-primary/15" : "bg-white/[0.03]"
        }`}
      >
        <span
          className={`text-3xl font-semibold ${
            isToday ? "text-primary" : "text-white"
          }`}
        >
          {release.releaseDate.getDate()}
        </span>
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-white/55">
          {new Intl.DateTimeFormat(undefined, {
            month: "short",
          }).format(release.releaseDate)}
        </span>
      </div>

      <div className="relative hidden w-24 shrink-0 border-r border-white/10 bg-white/[0.03] sm:block">
        <ImageWithFallback
          src={imageUrl}
          alt={release.title}
          className="flex h-full w-full items-center justify-center bg-white/[0.03] px-2 text-center text-[11px] text-white/45"
          imageClassName="h-full w-full object-cover"
          sizes="(max-width: 1024px) 20vw, 10vw"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <h2 className="line-clamp-2 text-base font-semibold text-white">
              {release.title}
            </h2>
            {release.nextEpisode ? (
              <>
                <p className="line-clamp-1 text-sm text-white/70">
                  Season {release.nextEpisode.seasonNumber} Episode{" "}
                  {release.nextEpisode.episodeNumber}
                </p>
                {release.nextEpisode.episodeName ? (
                  <p className="line-clamp-1 text-sm text-white/60">
                    {release.nextEpisode.episodeName}
                  </p>
                ) : null}
              </>
            ) : null}
            {!release.nextEpisode ? (
              <p className="text-sm text-white/60">{formattedReleaseDate}</p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2 rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium text-white/80 backdrop-blur-sm">
            <HugeiconsIcon
              icon={release.mediaType === "movie" ? Film01Icon : Tv01Icon}
              className="size-3.5"
            />
            <span>{release.mediaType === "movie" ? "Movie" : "TV"}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {release.sourceLists.map((sourceList) => (
              <span
                key={`${release.uniqueKey}-${sourceList}`}
                className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-white/65"
              >
                {getSourceListLabel(sourceList)}
              </span>
            ))}
          </div>

          <span className="rounded-full bg-primary/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
            {formatCountdown(release.releaseDate)}
          </span>
        </div>
      </div>
    </Link>
  )
}

function CalendarSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-28 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-48 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

interface ReleaseCalendarViewProps {
  releases: ReleaseCalendarRelease[]
  isLoading?: boolean
  isRefreshing?: boolean
  isPremium: boolean
  onUpgradeClick?: () => void
}

export function ReleaseCalendarView({
  releases,
  isLoading = false,
  isRefreshing = false,
  isPremium,
  onUpgradeClick,
}: ReleaseCalendarViewProps) {
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)

  const visibleReleases = useMemo(
    () => (isPremium ? releases : releases.slice(0, PREVIEW_LIMIT)),
    [isPremium, releases],
  )
  const visibleSections = useMemo(
    () => groupReleaseSections(visibleReleases),
    [visibleReleases],
  )
  const availableDates = useMemo(() => {
    const uniqueDates = new Map<string, Date>()

    for (const release of visibleReleases) {
      const date = parseTmdbDate(release.releaseDate)
      const dateKey = toLocalDateKey(date)
      if (!uniqueDates.has(dateKey)) {
        uniqueDates.set(dateKey, date)
      }
    }

    return [...uniqueDates.values()]
  }, [visibleReleases])

  const filteredSections = useMemo(() => {
    if (!selectedDateKey) {
      return visibleSections
    }

    return visibleSections
      .map((section) => ({
        ...section,
        data: section.data.filter(
          (release) => toLocalDateKey(release.releaseDate) >= selectedDateKey,
        ),
      }))
      .filter((section) => section.data.length > 0)
  }, [selectedDateKey, visibleSections])

  if (isLoading) {
    return <CalendarSkeleton />
  }

  if (releases.length === 0 && isRefreshing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-xs text-white/45">
          <HugeiconsIcon
            icon={Loading03Icon}
            className="size-3.5 animate-spin"
          />
          <span>Updating releases...</span>
        </div>
        <CalendarSkeleton />
      </div>
    )
  }

  if (releases.length === 0) {
    return (
      <Empty className="min-h-[420px] rounded-3xl border border-white/10 bg-white/[0.03]">
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

  return (
    <div className="space-y-8">
      {isRefreshing || !isPremium ? (
        <div className="flex items-center justify-between gap-4">
          {isRefreshing ? (
            <div className="flex items-center gap-2 text-xs text-white/45">
              <HugeiconsIcon
                icon={Loading03Icon}
                className="size-3.5 animate-spin"
              />
              <span>Refreshing releases...</span>
            </div>
          ) : (
            <div />
          )}

          {!isPremium ? (
            <div className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
              Previewing first {PREVIEW_LIMIT}
            </div>
          ) : null}
        </div>
      ) : null}

      {availableDates.length > 0 ? (
        <DateStrip
          dates={availableDates}
          selectedDateKey={selectedDateKey}
          onSelectDate={(dateKey) =>
            setSelectedDateKey((current) =>
              current === dateKey ? null : dateKey,
            )
          }
        />
      ) : null}

      <div className="space-y-10">
        {filteredSections.map((section) => (
          <section key={section.title} className="space-y-4">
            <div className="flex items-center gap-3">
              <HugeiconsIcon
                icon={Calendar03Icon}
                className="size-5 text-primary"
              />
              <h2 className="text-2xl font-semibold text-white">
                {section.title}
              </h2>
            </div>

            <div
              data-testid="release-calendar-section-grid"
              className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
            >
              {section.data.map((release) => (
                <ReleaseCard key={release.uniqueKey} release={release} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {!isPremium && releases.length > PREVIEW_LIMIT ? (
        <div
          data-testid="release-calendar-upgrade-cta"
          className="overflow-hidden rounded-3xl border border-amber-500/20 bg-linear-to-br from-amber-500/14 via-orange-500/10 to-transparent p-8"
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

export function ReleaseCalendarPageClient() {
  const {
    isPremium,
    premiumLoading,
    premiumStatus,
  } = useAuth()
  const { releases, isBootstrapping, isRefreshing, error } = useReleaseCalendar()
  const [showPremiumModal, setShowPremiumModal] = useState(false)

  const isPremiumPending = isPremiumStatusPending({
    premiumLoading,
    premiumStatus,
  })
  const canViewFullCalendar = !isPremiumPending && isPremium

  if (isBootstrapping) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-white/60">
          <HugeiconsIcon
            icon={Loading03Icon}
            className="size-5 animate-spin text-primary"
          />
          <span>Loading release calendar...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Empty className="min-h-[420px] rounded-3xl border border-white/10 bg-white/[0.03]">
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

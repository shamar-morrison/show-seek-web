import { parseTmdbDate, toLocalDateKey } from "@/lib/tmdb-date"
import type {
  CalendarMediaFilter,
  CalendarSortMode,
  CalendarSourceFilter,
  ReleaseCalendarDisplayItem,
  ReleaseCalendarGroupedDisplayItem,
  ReleaseCalendarLabels,
  ReleaseCalendarPresentation,
  ReleaseCalendarPresentationMap,
  ReleaseCalendarRelease,
  ReleaseCalendarRow,
  ReleaseCalendarSingleDisplayItem,
  ReleaseCalendarViewItem,
} from "@/types/release-calendar"

const DAY_MS = 24 * 60 * 60 * 1000
export const ALL_DATES_TEMPORAL_TAB_KEY = "all-dates" as const

export const CALENDAR_SOURCE_FILTERS = [
  "watchlist",
  "favorites",
  "currently-watching",
] as const satisfies readonly CalendarSourceFilter[]

interface CalendarPresentationOptions {
  labels: ReleaseCalendarLabels
  locale?: string
  previewLimit?: number
  referenceDate?: Date
  releases: ReleaseCalendarRelease[]
  sortMode: CalendarSortMode
}

interface CalendarEntry {
  sectionKey?: string
  sectionTitle?: string
  sectionKind?: "month" | "media-type"
  item: ReleaseCalendarDisplayItem
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function getCalendarDayOffset(
  date: Date,
  referenceDate: Date = new Date(),
): number {
  return Math.round(
    (startOfLocalDay(date).getTime() - startOfLocalDay(referenceDate).getTime()) /
      DAY_MS,
  )
}

export function toReleaseCalendarViewItem(
  release: ReleaseCalendarRelease,
): ReleaseCalendarViewItem {
  return {
    ...release,
    releaseDate: parseTmdbDate(release.releaseDate),
  }
}

export function getReleaseCalendarSources(
  release: Pick<ReleaseCalendarRelease, "sourceLists">,
): CalendarSourceFilter[] {
  const sources = new Set<CalendarSourceFilter>()

  for (const source of release.sourceLists) {
    if (CALENDAR_SOURCE_FILTERS.includes(source)) {
      sources.add(source)
    }
  }

  return [...sources]
}

export function filterReleaseCalendarReleases(
  releases: ReleaseCalendarRelease[],
  {
    mediaFilter,
    selectedSources,
  }: {
    mediaFilter: CalendarMediaFilter
    selectedSources: CalendarSourceFilter[]
  },
): ReleaseCalendarRelease[] {
  const selectedSourceSet = new Set(selectedSources)

  return releases.filter((release) => {
    if (mediaFilter !== "all" && release.mediaType !== mediaFilter) {
      return false
    }

    return getReleaseCalendarSources(release).some((source) =>
      selectedSourceSet.has(source),
    )
  })
}

export function buildReleaseCalendarPresentation({
  labels,
  locale,
  previewLimit,
  referenceDate = new Date(),
  releases,
  sortMode,
}: CalendarPresentationOptions): ReleaseCalendarPresentation {
  const entries = buildCalendarEntries({
    labels,
    locale,
    releases,
    sortMode,
  })
  const totalContentCount = entries.length
  const visibleEntries =
    previewLimit === undefined ? entries : entries.slice(0, Math.max(previewLimit, 0))
  const { entryRows, rows } = buildRows(visibleEntries)
  const { temporalTabAnchors, temporalTabs } = buildTemporalTabs({
    entryRows,
    labels,
    locale,
    referenceDate,
    sortMode,
  })

  return {
    rows,
    temporalTabs,
    temporalTabAnchors,
    totalContentCount,
    visibleContentCount: visibleEntries.length,
  }
}

export function buildReleaseCalendarPresentations({
  labels,
  locale,
  previewLimit,
  referenceDate = new Date(),
  releases,
  sortMode,
}: CalendarPresentationOptions): ReleaseCalendarPresentationMap {
  const releasesByMedia: Record<CalendarMediaFilter, ReleaseCalendarRelease[]> = {
    all: releases,
    movie: [],
    tv: [],
  }

  for (const release of releases) {
    releasesByMedia[release.mediaType].push(release)
  }

  const createPresentation = (mediaFilter: CalendarMediaFilter) =>
    buildReleaseCalendarPresentation({
      labels,
      locale,
      previewLimit,
      referenceDate,
      releases: releasesByMedia[mediaFilter],
      sortMode,
    })

  return {
    all: createPresentation("all"),
    movie: createPresentation("movie"),
    tv: createPresentation("tv"),
  }
}

export function filterReleaseCalendarRowsByTemporalTab(
  rows: ReleaseCalendarRow[],
  temporalTabKey: string,
  referenceDate: Date = new Date(),
): ReleaseCalendarRow[] {
  if (temporalTabKey === ALL_DATES_TEMPORAL_TAB_KEY) {
    return rows
  }

  const filteredRows: ReleaseCalendarRow[] = []
  let pendingHeader: Extract<ReleaseCalendarRow, { type: "section-header" }> | null =
    null

  for (const row of rows) {
    if (row.type === "section-header") {
      pendingHeader = row
      continue
    }

    const filteredRow = filterContentRowByTemporalTab(
      row,
      temporalTabKey,
      referenceDate,
    )

    if (!filteredRow) {
      continue
    }

    if (pendingHeader) {
      filteredRows.push(pendingHeader)
      pendingHeader = null
    }

    filteredRows.push(filteredRow)
  }

  return filteredRows
}

function filterContentRowByTemporalTab(
  row: Exclude<ReleaseCalendarRow, { type: "section-header" }>,
  temporalTabKey: string,
  referenceDate: Date,
): Exclude<ReleaseCalendarRow, { type: "section-header" }> | null {
  if (row.type === "single-release") {
    return doesDateMatchTemporalTab(
      row.item.releaseDate,
      temporalTabKey,
      referenceDate,
    )
      ? row
      : null
  }

  const episodes = row.item.episodes.filter((episode) =>
    doesDateMatchTemporalTab(
      episode.releaseDate,
      temporalTabKey,
      referenceDate,
    ),
  )

  if (episodes.length === 0) {
    return null
  }

  return {
    ...row,
    item: {
      ...row.item,
      episodes,
      releaseDate: episodes[0].releaseDate,
    },
  }
}

export function doesDateMatchTemporalTab(
  date: Date,
  temporalTabKey: string,
  referenceDate: Date = new Date(),
): boolean {
  const dayOffset = getCalendarDayOffset(date, referenceDate)

  if (temporalTabKey === "today") {
    return dayOffset === 0
  }

  if (temporalTabKey === "tomorrow") {
    return dayOffset === 1
  }

  if (temporalTabKey === "this-week") {
    return dayOffset >= 2 && dayOffset <= 7
  }

  if (temporalTabKey === "next-week") {
    return dayOffset >= 8 && dayOffset <= 14
  }

  if (temporalTabKey.startsWith("month-")) {
    return temporalTabKey === `month-${getMonthKey(date)}`
  }

  return true
}

function buildCalendarEntries({
  labels,
  locale,
  releases,
  sortMode,
}: {
  labels: ReleaseCalendarLabels
  locale?: string
  releases: ReleaseCalendarRelease[]
  sortMode: CalendarSortMode
}): CalendarEntry[] {
  if (sortMode === "alphabetical") {
    const collator = new Intl.Collator(locale, { sensitivity: "base" })

    return buildGroupedItems(releases, (release) => `tv-${release.id}`)
      .sort((left, right) => collator.compare(getDisplayTitle(left), getDisplayTitle(right)))
      .map((item) => ({ item }))
  }

  if (sortMode === "type") {
    const movieItems = releases
      .filter((release) => release.mediaType === "movie")
      .sort(compareReleasesByDate)
      .map((release) => createSingleDisplayItem(release))
    const tvItems = buildGroupedItems(
      releases.filter((release) => release.mediaType === "tv"),
      (release) => `tv-${release.id}`,
    ).sort(compareDisplayItemsByDate)

    return [
      ...movieItems.map((item) => ({
        item,
        sectionKey: "movies",
        sectionKind: "media-type" as const,
        sectionTitle: labels.movies,
      })),
      ...tvItems.map((item) => ({
        item,
        sectionKey: "tv-shows",
        sectionKind: "media-type" as const,
        sectionTitle: labels.tvShows,
      })),
    ]
  }

  const monthMap = new Map<
    string,
    {
      releases: ReleaseCalendarRelease[]
      title: string
    }
  >()

  for (const release of [...releases].sort(compareReleasesByDate)) {
    const monthKey = getMonthKey(parseTmdbDate(release.releaseDate))
    const existing = monthMap.get(monthKey)

    if (existing) {
      existing.releases.push(release)
      continue
    }

    monthMap.set(monthKey, {
      releases: [release],
      title: formatMonthYear(parseTmdbDate(release.releaseDate), locale),
    })
  }

  const entries: CalendarEntry[] = []

  for (const [monthKey, month] of monthMap.entries()) {
    for (const item of buildGroupedItems(
      month.releases,
      (release) => `tv-${release.id}-${monthKey}`,
    )) {
      entries.push({
        item,
        sectionKey: monthKey,
        sectionKind: "month",
        sectionTitle: month.title,
      })
    }
  }

  return entries
}

function buildGroupedItems(
  releases: ReleaseCalendarRelease[],
  scopeKeyForTV: (release: ReleaseCalendarRelease) => string,
): ReleaseCalendarDisplayItem[] {
  const buckets = new Map<
    string,
    {
      firstIndex: number
      releases: ReleaseCalendarRelease[]
    }
  >()

  for (const [index, release] of [...releases].sort(compareReleasesByDate).entries()) {
    const bucketKey =
      release.mediaType === "tv" ? scopeKeyForTV(release) : release.uniqueKey
    const existing = buckets.get(bucketKey)

    if (existing) {
      existing.releases.push(release)
      continue
    }

    buckets.set(bucketKey, {
      firstIndex: index,
      releases: [release],
    })
  }

  return [...buckets.entries()]
    .sort((left, right) => left[1].firstIndex - right[1].firstIndex)
    .map(([bucketKey, bucket]) => createDisplayItem(bucketKey, bucket.releases))
}

function createDisplayItem(
  bucketKey: string,
  releases: ReleaseCalendarRelease[],
): ReleaseCalendarDisplayItem {
  const orderedReleases = [...releases].sort(compareReleasesByDate)
  const firstRelease = orderedReleases[0]

  if (firstRelease.mediaType === "tv" && orderedReleases.length > 1) {
    const episodes = orderedReleases.map(toReleaseCalendarViewItem)
    const sourceFilters = new Set<CalendarSourceFilter>()

    for (const release of orderedReleases) {
      for (const source of getReleaseCalendarSources(release)) {
        sourceFilters.add(source)
      }
    }

    return {
      type: "group",
      key: bucketKey,
      showId: firstRelease.id,
      title: firstRelease.title,
      posterPath: firstRelease.posterPath,
      backdropPath: firstRelease.backdropPath,
      releaseDate: episodes[0].releaseDate,
      episodes,
      sourceFilters: [...sourceFilters],
    }
  }

  return createSingleDisplayItem(firstRelease)
}

function createSingleDisplayItem(
  release: ReleaseCalendarRelease,
): ReleaseCalendarSingleDisplayItem {
  const viewItem = toReleaseCalendarViewItem(release)

  return {
    type: "single",
    key: viewItem.uniqueKey,
    release: viewItem,
    releaseDate: viewItem.releaseDate,
  }
}

function buildRows(entries: CalendarEntry[]): {
  rows: ReleaseCalendarRow[]
  entryRows: Array<{ item: ReleaseCalendarDisplayItem; rowIndex: number }>
} {
  const rows: ReleaseCalendarRow[] = []
  const entryRows: Array<{ item: ReleaseCalendarDisplayItem; rowIndex: number }> = []
  let currentSectionKey: string | undefined

  for (const entry of entries) {
    if (entry.sectionKey && entry.sectionKey !== currentSectionKey) {
      rows.push({
        type: "section-header",
        key: `section-${entry.sectionKey}`,
        title: entry.sectionTitle ?? "",
        sectionKind: entry.sectionKind ?? "month",
      })
      currentSectionKey = entry.sectionKey
    }

    rows.push(
      entry.item.type === "single"
        ? {
            type: "single-release",
            key: entry.item.key,
            item: entry.item,
          }
        : {
            type: "grouped-release",
            key: entry.item.key,
            item: entry.item,
          },
    )

    entryRows.push({
      item: entry.item,
      rowIndex: rows.length - 1,
    })
  }

  return {
    rows,
    entryRows,
  }
}

function buildTemporalTabs({
  entryRows,
  labels,
  locale,
  referenceDate,
  sortMode,
}: {
  entryRows: Array<{ item: ReleaseCalendarDisplayItem; rowIndex: number }>
  labels: ReleaseCalendarLabels
  locale?: string
  referenceDate: Date
  sortMode: CalendarSortMode
}): Pick<ReleaseCalendarPresentation, "temporalTabs" | "temporalTabAnchors"> {
  if (sortMode !== "soonest") {
    return {
      temporalTabs: [],
      temporalTabAnchors: {},
    }
  }

  const temporalTabs: ReleaseCalendarPresentation["temporalTabs"] = []
  const temporalTabAnchors: Record<string, number> = {}
  const registeredTabs = new Set<string>()

  for (const { item, rowIndex } of entryRows) {
    const seenDateKeys = new Set<string>()

    for (const date of getItemDates(item)) {
      const dateKey = toLocalDateKey(date)
      if (seenDateKeys.has(dateKey)) {
        continue
      }
      seenDateKeys.add(dateKey)

      const dayOffset = getCalendarDayOffset(date, referenceDate)

      if (dayOffset === 0) {
        registerTemporalTab({
          key: "today",
          kind: "today",
          label: labels.today,
          registeredTabs,
          rowIndex,
          temporalTabAnchors,
          temporalTabs,
        })
        continue
      }

      if (dayOffset === 1) {
        registerTemporalTab({
          key: "tomorrow",
          kind: "tomorrow",
          label: labels.tomorrow,
          registeredTabs,
          rowIndex,
          temporalTabAnchors,
          temporalTabs,
        })
        continue
      }

      if (dayOffset >= 2 && dayOffset <= 7) {
        registerTemporalTab({
          key: "this-week",
          kind: "this-week",
          label: labels.thisWeek,
          registeredTabs,
          rowIndex,
          temporalTabAnchors,
          temporalTabs,
        })
        continue
      }

      if (dayOffset >= 8 && dayOffset <= 14) {
        registerTemporalTab({
          key: "next-week",
          kind: "next-week",
          label: labels.nextWeek,
          registeredTabs,
          rowIndex,
          temporalTabAnchors,
          temporalTabs,
        })
        continue
      }

      if (dayOffset > 14) {
        const monthKey = getMonthKey(date)
        registerTemporalTab({
          key: `month-${monthKey}`,
          kind: "month",
          label: formatMonthYear(date, locale),
          registeredTabs,
          rowIndex,
          temporalTabAnchors,
          temporalTabs,
        })
      }
    }
  }

  return {
    temporalTabs,
    temporalTabAnchors,
  }
}

function registerTemporalTab({
  key,
  kind,
  label,
  registeredTabs,
  rowIndex,
  temporalTabAnchors,
  temporalTabs,
}: {
  key: string
  kind: ReleaseCalendarPresentation["temporalTabs"][number]["kind"]
  label: string
  registeredTabs: Set<string>
  rowIndex: number
  temporalTabAnchors: Record<string, number>
  temporalTabs: ReleaseCalendarPresentation["temporalTabs"]
}) {
  if (registeredTabs.has(key)) {
    return
  }

  temporalTabs.push({
    key,
    label,
    kind,
  })
  temporalTabAnchors[key] = rowIndex
  registeredTabs.add(key)
}

function compareReleasesByDate(
  left: ReleaseCalendarRelease,
  right: ReleaseCalendarRelease,
): number {
  if (left.releaseDate !== right.releaseDate) {
    return left.releaseDate.localeCompare(right.releaseDate)
  }

  if (left.mediaType !== right.mediaType) {
    return left.mediaType.localeCompare(right.mediaType)
  }

  return left.title.localeCompare(right.title)
}

function compareDisplayItemsByDate(
  left: ReleaseCalendarDisplayItem,
  right: ReleaseCalendarDisplayItem,
): number {
  const timeDifference = left.releaseDate.getTime() - right.releaseDate.getTime()
  if (timeDifference !== 0) {
    return timeDifference
  }

  return getDisplayTitle(left).localeCompare(getDisplayTitle(right))
}

function getDisplayTitle(item: ReleaseCalendarDisplayItem): string {
  return item.type === "single" ? item.release.title : item.title
}

function getItemDates(item: ReleaseCalendarDisplayItem): Date[] {
  if (item.type === "single") {
    return [item.release.releaseDate]
  }

  return item.episodes.map((episode) => episode.releaseDate)
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function formatMonthYear(date: Date, locale?: string): string {
  return date.toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  })
}

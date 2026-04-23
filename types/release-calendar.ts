import type { SupportedRegionCode } from "@/lib/regions"

export type TrackedCalendarListId =
  | "watchlist"
  | "favorites"
  | "currently-watching"

export interface ReleaseCalendarTrackedItem {
  id: number
  mediaType: "movie" | "tv"
  title: string
  name?: string
  posterPath: string | null
  releaseDate?: string
  firstAirDate?: string
  sourceList: TrackedCalendarListId
}

export interface ReleaseCalendarNextEpisode {
  seasonNumber: number
  episodeNumber: number
  episodeName?: string
}

export interface ReleaseCalendarRelease {
  id: number
  mediaType: "movie" | "tv"
  title: string
  posterPath: string | null
  backdropPath: string | null
  releaseDate: string
  nextEpisode?: ReleaseCalendarNextEpisode
  sourceLists: TrackedCalendarListId[]
  uniqueKey: string
}

export interface ReleaseCalendarViewItem
  extends Omit<ReleaseCalendarRelease, "releaseDate"> {
  releaseDate: Date
}

export interface ReleaseCalendarSection {
  title: string
  data: ReleaseCalendarViewItem[]
}

export type CalendarSourceFilter = TrackedCalendarListId

export type CalendarMediaFilter = "all" | "movie" | "tv"

export type CalendarSortMode = "soonest" | "alphabetical" | "type"

export interface ReleaseCalendarLabels {
  today: string
  tomorrow: string
  thisWeek: string
  nextWeek: string
  movies: string
  tvShows: string
}

export interface ReleaseCalendarTemporalTab {
  key: string
  label: string
  kind: "today" | "tomorrow" | "this-week" | "next-week" | "month"
}

export interface ReleaseCalendarSingleDisplayItem {
  type: "single"
  key: string
  release: ReleaseCalendarViewItem
  releaseDate: Date
}

export interface ReleaseCalendarGroupedDisplayItem {
  type: "group"
  key: string
  showId: number
  title: string
  posterPath: string | null
  backdropPath: string | null
  releaseDate: Date
  episodes: ReleaseCalendarViewItem[]
  sourceFilters: CalendarSourceFilter[]
}

export type ReleaseCalendarDisplayItem =
  | ReleaseCalendarSingleDisplayItem
  | ReleaseCalendarGroupedDisplayItem

export interface ReleaseCalendarSectionHeaderRow {
  type: "section-header"
  key: string
  title: string
  sectionKind: "month" | "media-type"
}

export interface ReleaseCalendarSingleReleaseRow {
  type: "single-release"
  key: string
  item: ReleaseCalendarSingleDisplayItem
}

export interface ReleaseCalendarGroupedReleaseRow {
  type: "grouped-release"
  key: string
  item: ReleaseCalendarGroupedDisplayItem
}

export type ReleaseCalendarRow =
  | ReleaseCalendarSectionHeaderRow
  | ReleaseCalendarSingleReleaseRow
  | ReleaseCalendarGroupedReleaseRow

export interface ReleaseCalendarPresentation {
  rows: ReleaseCalendarRow[]
  temporalTabs: ReleaseCalendarTemporalTab[]
  temporalTabAnchors: Record<string, number>
  totalContentCount: number
  visibleContentCount: number
}

export type ReleaseCalendarPresentationMap = Record<
  CalendarMediaFilter,
  ReleaseCalendarPresentation
>

export interface FetchReleaseCalendarInput {
  items: ReleaseCalendarTrackedItem[]
  region: SupportedRegionCode
  todayKey: string
}

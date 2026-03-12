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

export interface FetchReleaseCalendarInput {
  items: ReleaseCalendarTrackedItem[]
  region: SupportedRegionCode
  todayKey: string
}

import { describe, expect, it } from "vitest"

import {
  ALL_DATES_TEMPORAL_TAB_KEY,
  buildReleaseCalendarPresentation,
  buildReleaseCalendarPresentations,
  filterReleaseCalendarRowsByTemporalTab,
  filterReleaseCalendarReleases,
} from "@/lib/release-calendar-presentation"
import type {
  CalendarSortMode,
  ReleaseCalendarLabels,
  ReleaseCalendarRelease,
  ReleaseCalendarRow,
} from "@/types/release-calendar"

const LABELS: ReleaseCalendarLabels = {
  today: "Today",
  tomorrow: "Tomorrow",
  thisWeek: "This Week",
  nextWeek: "Next Week",
  movies: "Movies",
  tvShows: "TV Shows",
}

function createRelease(
  overrides: Partial<ReleaseCalendarRelease>,
): ReleaseCalendarRelease {
  const mediaType = overrides.mediaType ?? "movie"
  const id = overrides.id ?? 1
  const nextEpisode = overrides.nextEpisode

  return {
    id,
    mediaType,
    title: overrides.title ?? `Release ${id}`,
    posterPath: null,
    backdropPath: null,
    releaseDate: overrides.releaseDate ?? "2026-01-10",
    nextEpisode,
    sourceLists: overrides.sourceLists ?? ["watchlist"],
    uniqueKey:
      overrides.uniqueKey ??
      (mediaType === "tv" && nextEpisode
        ? `tv-${id}-s${nextEpisode.seasonNumber}-e${nextEpisode.episodeNumber}`
        : `${mediaType}-${id}`),
  }
}

function buildPresentation(
  releases: ReleaseCalendarRelease[],
  {
    previewLimit,
    sortMode = "soonest",
  }: {
    previewLimit?: number
    sortMode?: CalendarSortMode
  } = {},
) {
  return buildReleaseCalendarPresentation({
    labels: LABELS,
    locale: "en-US",
    previewLimit,
    referenceDate: new Date(2026, 0, 10),
    releases,
    sortMode,
  })
}

function getContentTitles(rows: ReleaseCalendarRow[]): string[] {
  return rows.flatMap((row) => {
    if (row.type === "single-release") {
      return [row.item.release.title]
    }

    if (row.type === "grouped-release") {
      return [row.item.title]
    }

    return []
  })
}

describe("release calendar presentation", () => {
  it("filters releases by media type and selected tracked list sources", () => {
    const releases = [
      createRelease({
        id: 1,
        mediaType: "movie",
        sourceLists: ["watchlist"],
      }),
      createRelease({
        id: 2,
        mediaType: "tv",
        sourceLists: ["favorites"],
        nextEpisode: { seasonNumber: 1, episodeNumber: 1 },
      }),
      createRelease({
        id: 3,
        mediaType: "movie",
        sourceLists: ["currently-watching"],
      }),
    ]

    expect(
      filterReleaseCalendarReleases(releases, {
        mediaFilter: "tv",
        selectedSources: ["favorites"],
      }).map((release) => release.id),
    ).toEqual([2])

    expect(
      filterReleaseCalendarReleases(releases, {
        mediaFilter: "all",
        selectedSources: ["currently-watching"],
      }).map((release) => release.id),
    ).toEqual([3])
  })

  it("builds temporal tabs and row anchors for soonest mode", () => {
    const presentation = buildPresentation([
      createRelease({ id: 1, releaseDate: "2026-01-10" }),
      createRelease({ id: 2, releaseDate: "2026-01-11" }),
      createRelease({
        id: 3,
        mediaType: "tv",
        title: "Show One",
        releaseDate: "2026-01-12",
        sourceLists: ["currently-watching"],
        nextEpisode: {
          seasonNumber: 1,
          episodeNumber: 3,
          episodeName: "Episode 3",
        },
      }),
      createRelease({
        id: 3,
        mediaType: "tv",
        title: "Show One",
        releaseDate: "2026-01-13",
        sourceLists: ["currently-watching"],
        nextEpisode: {
          seasonNumber: 1,
          episodeNumber: 4,
          episodeName: "Episode 4",
        },
      }),
      createRelease({ id: 4, releaseDate: "2026-01-18" }),
      createRelease({ id: 5, releaseDate: "2026-02-03" }),
    ])

    expect(presentation.rows.map((row) => row.type)).toEqual([
      "section-header",
      "single-release",
      "single-release",
      "grouped-release",
      "single-release",
      "section-header",
      "single-release",
    ])
    expect(presentation.temporalTabs.map((tab) => tab.label)).toEqual([
      "Today",
      "Tomorrow",
      "This Week",
      "Next Week",
      "February 2026",
    ])
    expect(presentation.temporalTabAnchors).toEqual({
      today: 1,
      tomorrow: 2,
      "this-week": 3,
      "next-week": 4,
      "month-2026-02": 6,
    })
  })

  it("filters presentation rows by temporal buckets without exposing hidden preview rows", () => {
    const presentation = buildPresentation([
      createRelease({
        id: 1,
        title: "Today Movie",
        releaseDate: "2026-01-10",
      }),
      createRelease({
        id: 2,
        title: "Tomorrow Movie",
        releaseDate: "2026-01-11",
      }),
      createRelease({
        id: 7,
        mediaType: "tv",
        title: "Shared Show",
        releaseDate: "2026-01-12",
        sourceLists: ["currently-watching"],
        nextEpisode: {
          seasonNumber: 1,
          episodeNumber: 1,
          episodeName: "This Week",
        },
      }),
      createRelease({
        id: 7,
        mediaType: "tv",
        title: "Shared Show",
        releaseDate: "2026-01-18",
        sourceLists: ["currently-watching"],
        nextEpisode: {
          seasonNumber: 1,
          episodeNumber: 2,
          episodeName: "Next Week",
        },
      }),
      createRelease({
        id: 3,
        title: "Month Movie",
        releaseDate: "2026-02-03",
      }),
      createRelease({
        id: 4,
        title: "Preview Hidden",
        releaseDate: "2026-02-04",
      }),
    ], { previewLimit: 3 })

    expect(
      filterReleaseCalendarRowsByTemporalTab(
        presentation.rows,
        ALL_DATES_TEMPORAL_TAB_KEY,
        new Date(2026, 0, 10),
      ),
    ).toBe(presentation.rows)
    expect(
      getContentTitles(
        filterReleaseCalendarRowsByTemporalTab(
          presentation.rows,
          "today",
          new Date(2026, 0, 10),
        ),
      ),
    ).toEqual(["Today Movie"])
    expect(
      getContentTitles(
        filterReleaseCalendarRowsByTemporalTab(
          presentation.rows,
          "tomorrow",
          new Date(2026, 0, 10),
        ),
      ),
    ).toEqual(["Tomorrow Movie"])

    const thisWeekRows = filterReleaseCalendarRowsByTemporalTab(
      presentation.rows,
      "this-week",
      new Date(2026, 0, 10),
    )
    const thisWeekShow = thisWeekRows.find(
      (row) => row.type === "grouped-release",
    )

    expect(getContentTitles(thisWeekRows)).toEqual(["Shared Show"])
    expect(thisWeekShow).toMatchObject({
      type: "grouped-release",
      item: {
        episodes: [expect.objectContaining({ uniqueKey: "tv-7-s1-e1" })],
      },
    })
    expect(
      getContentTitles(
        filterReleaseCalendarRowsByTemporalTab(
          presentation.rows,
          "next-week",
          new Date(2026, 0, 10),
        ),
      ),
    ).toEqual(["Shared Show"])
    expect(
      getContentTitles(
        filterReleaseCalendarRowsByTemporalTab(
          presentation.rows,
          "month-2026-02",
          new Date(2026, 0, 10),
        ),
      ),
    ).toEqual([])
  })

  it("groups TV rows per month in soonest mode and across months in alphabetical mode", () => {
    const releases = [
      createRelease({
        id: 7,
        mediaType: "tv",
        title: "Shared Show",
        releaseDate: "2026-01-12",
        sourceLists: ["currently-watching"],
        nextEpisode: {
          seasonNumber: 1,
          episodeNumber: 1,
          episodeName: "One",
        },
      }),
      createRelease({
        id: 7,
        mediaType: "tv",
        title: "Shared Show",
        releaseDate: "2026-02-02",
        sourceLists: ["currently-watching"],
        nextEpisode: {
          seasonNumber: 1,
          episodeNumber: 2,
          episodeName: "Two",
        },
      }),
    ]

    expect(buildPresentation(releases).totalContentCount).toBe(2)
    expect(buildPresentation(releases, { sortMode: "alphabetical" }).totalContentCount).toBe(1)
  })

  it("builds cached media presentations and truncates previews by visible content item", () => {
    const releases = [
      createRelease({
        id: 1,
        mediaType: "movie",
        title: "Movie First",
        releaseDate: "2026-01-11",
      }),
      createRelease({
        id: 9,
        mediaType: "tv",
        title: "Show Later",
        releaseDate: "2026-01-12",
        sourceLists: ["currently-watching"],
        nextEpisode: {
          seasonNumber: 1,
          episodeNumber: 3,
          episodeName: "Three",
        },
      }),
      createRelease({
        id: 9,
        mediaType: "tv",
        title: "Show Later",
        releaseDate: "2026-01-13",
        sourceLists: ["currently-watching"],
        nextEpisode: {
          seasonNumber: 1,
          episodeNumber: 4,
          episodeName: "Four",
        },
      }),
      createRelease({
        id: 2,
        mediaType: "movie",
        title: "Movie Last",
        releaseDate: "2026-01-14",
      }),
    ]

    const presentations = buildReleaseCalendarPresentations({
      labels: LABELS,
      locale: "en-US",
      previewLimit: 2,
      referenceDate: new Date(2026, 0, 10),
      releases,
      sortMode: "soonest",
    })

    expect(presentations.all.totalContentCount).toBe(3)
    expect(presentations.movie.totalContentCount).toBe(2)
    expect(presentations.tv.totalContentCount).toBe(1)
    expect(presentations.all.visibleContentCount).toBe(2)
    expect(
      presentations.all.rows.filter(
        (row) => row.type === "single-release" || row.type === "grouped-release",
      ),
    ).toHaveLength(2)
    expect(
      presentations.all.rows.find((row) => row.type === "grouped-release"),
    ).toMatchObject({
      type: "grouped-release",
      item: {
        episodes: [
          expect.objectContaining({ uniqueKey: "tv-9-s1-e3" }),
          expect.objectContaining({ uniqueKey: "tv-9-s1-e4" }),
        ],
      },
    })
  })

  it("builds type sections with movies first and TV shows second", () => {
    const presentation = buildPresentation(
      [
        createRelease({
          id: 9,
          mediaType: "tv",
          title: "Show Later",
          releaseDate: "2026-01-12",
          sourceLists: ["currently-watching"],
          nextEpisode: {
            seasonNumber: 1,
            episodeNumber: 3,
            episodeName: "Three",
          },
        }),
        createRelease({
          id: 1,
          mediaType: "movie",
          title: "Movie First",
          releaseDate: "2026-01-11",
        }),
      ],
      { sortMode: "type" },
    )

    expect(presentation.rows.map((row) => row.type)).toEqual([
      "section-header",
      "single-release",
      "section-header",
      "single-release",
    ])
    expect(
      presentation.rows
        .filter((row) => row.type === "section-header")
        .map((row) => row.title),
    ).toEqual(["Movies", "TV Shows"])
  })
})

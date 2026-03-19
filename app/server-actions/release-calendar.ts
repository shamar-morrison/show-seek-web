"use server"

import {
  buildReleaseCalendarReleases,
  dedupeTrackedItems,
} from "@/lib/release-calendar"
import {
  getMovieCalendarDetails,
  getSeasonDetails,
  getTVCalendarDetails,
} from "@/lib/tmdb"
import type { FetchReleaseCalendarInput } from "@/types/release-calendar"

const CALENDAR_FETCH_CONCURRENCY = 5

function summarizeReleaseCalendarInput(input: FetchReleaseCalendarInput) {
  const dedupedItems = dedupeTrackedItems(input.items)
  const movieCount = dedupedItems.filter(
    (item) => item.mediaType === "movie",
  ).length

  return {
    chunkSize: dedupedItems.length,
    movieCount,
    tvCount: dedupedItems.length - movieCount,
  }
}

export async function fetchReleaseCalendarReleases(
  input: FetchReleaseCalendarInput,
) {
  const inputSummary = summarizeReleaseCalendarInput(input)

  if (process.env.NODE_ENV !== "test") {
    console.info("[ReleaseCalendar] Fetch chunk", inputSummary)
  }

  try {
    return await buildReleaseCalendarReleases(input, {
      fetchMovieDetails: getMovieCalendarDetails,
      fetchTVDetails: getTVCalendarDetails,
      fetchSeasonDetails: getSeasonDetails,
      concurrency: CALENDAR_FETCH_CONCURRENCY,
    })
  } catch (error) {
    console.error(
      "Server Action: Failed to fetch release calendar releases",
      inputSummary,
      error,
    )
    return []
  }
}

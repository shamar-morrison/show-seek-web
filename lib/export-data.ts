/**
 * Export user data to CSV or Markdown format
 * Matches mobile app export formats per spec.md
 */

import { db } from "@/lib/firebase/config"
import { getMovieDetails, getTVDetails } from "@/lib/tmdb"
import { collection, getDocs } from "firebase/firestore"

// ============================================================================
// Types
// ============================================================================

interface ListMediaItem {
  id: number
  media_type: "movie" | "tv"
  title?: string // For movies
  name?: string // For TV
}

interface RatingDoc {
  id: string
  mediaId: string
  mediaType: "movie" | "tv" | "episode"
  rating: number
  title?: string
  tvShowName?: string
  episodeName?: string
  seasonNumber?: number
  episodeNumber?: number
}

interface FavoritePerson {
  id: number
  name: string
}

interface ListDoc {
  id: string
  name: string
  items?: Record<string, ListMediaItem>
}

interface EnrichedRating {
  title: string
  type: "Movie" | "TV" | "Episode"
  rating: number
}

// ============================================================================
// Data Fetching
// ============================================================================

async function fetchLists(userId: string): Promise<ListDoc[]> {
  const snapshot = await getDocs(collection(db, "users", userId, "lists"))
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    name: (doc.data().name as string) || doc.id,
    items: doc.data().items as Record<string, ListMediaItem> | undefined,
  }))
}

async function fetchRatings(userId: string): Promise<RatingDoc[]> {
  const snapshot = await getDocs(collection(db, "users", userId, "ratings"))
  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      id: doc.id,
      mediaId: data.mediaId as string,
      mediaType: data.mediaType as "movie" | "tv" | "episode",
      rating: data.rating as number,
      title: data.title as string | undefined,
      tvShowName: data.tvShowName as string | undefined,
      episodeName: data.episodeName as string | undefined,
      seasonNumber: data.seasonNumber as number | undefined,
      episodeNumber: data.episodeNumber as number | undefined,
    }
  })
}

async function fetchFavoritePersons(userId: string): Promise<FavoritePerson[]> {
  const snapshot = await getDocs(
    collection(db, "users", userId, "favorite_persons"),
  )
  return snapshot.docs.map((doc) => ({
    id: doc.data().id as number,
    name: (doc.data().name as string) || "Unknown",
  }))
}

// ============================================================================
// TMDB Enrichment
// ============================================================================

/**
 * Fetch title with timeout
 */
async function fetchWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T | null> {
  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), timeoutMs),
  )
  return Promise.race([promise, timeout])
}

/**
 * Enrich ratings with TMDB titles
 * Movies and TV shows need title fetching, episodes use stored data
 */
async function enrichRatings(ratings: RatingDoc[]): Promise<EnrichedRating[]> {
  const enriched: EnrichedRating[] = []

  // Process in parallel with individual timeouts
  const promises = ratings.map(async (rating): Promise<EnrichedRating> => {
    const mediaId = parseInt(rating.mediaId, 10)

    if (rating.mediaType === "movie") {
      // If we already have a title stored, use it
      if (rating.title) {
        return { title: rating.title, type: "Movie", rating: rating.rating }
      }
      // Fetch from TMDB with 10s timeout
      const details = await fetchWithTimeout(getMovieDetails(mediaId), 10000)
      const title = details?.title || `Movie ID: ${rating.mediaId}`
      return { title, type: "Movie", rating: rating.rating }
    }

    if (rating.mediaType === "tv") {
      // If we already have a title stored, use it
      if (rating.title) {
        return { title: rating.title, type: "TV", rating: rating.rating }
      }
      // Fetch from TMDB with 10s timeout
      const details = await fetchWithTimeout(getTVDetails(mediaId), 10000)
      const title = details?.name || `TV Show ID: ${rating.mediaId}`
      return { title, type: "TV", rating: rating.rating }
    }

    // Episode: use stored data with fallbacks
    let title = rating.tvShowName || "Unknown Show"
    if (rating.episodeName) {
      title += ` - ${rating.episodeName}`
    } else if (
      rating.seasonNumber !== undefined &&
      rating.episodeNumber !== undefined
    ) {
      title += ` - S${rating.seasonNumber}E${rating.episodeNumber}`
    }
    return { title, type: "Episode", rating: rating.rating }
  })

  const results = await Promise.allSettled(promises)
  for (const result of results) {
    if (result.status === "fulfilled") {
      enriched.push(result.value)
    }
  }

  return enriched
}

// ============================================================================
// CSV Export
// ============================================================================

/**
 * Escape a string for CSV
 * Wraps in quotes if contains comma, newline, or quote
 * Doubles internal quotes
 */
function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Export user data as CSV per spec.md
 * Headers: Category,Title,Type,Rating
 */
export async function exportToCSV(userId: string): Promise<void> {
  // Fetch all data in parallel
  const [lists, ratings, favoritePersons] = await Promise.all([
    fetchLists(userId),
    fetchRatings(userId),
    fetchFavoritePersons(userId),
  ])

  // Enrich ratings with TMDB titles
  const enrichedRatings = await enrichRatings(ratings)

  // Build CSV rows
  const rows: string[] = ["Category,Title,Type,Rating"]

  // Lists
  for (const list of lists) {
    const categoryEscaped = escapeCSV(`List: ${list.name}`)
    if (list.items && typeof list.items === "object") {
      for (const item of Object.values(list.items)) {
        const title = item.title || item.name || "Unknown"
        const type = item.media_type === "movie" ? "Movie" : "TV"
        rows.push(`${categoryEscaped},${escapeCSV(title)},${type},`)
      }
    }
  }

  // Ratings
  for (const rating of enrichedRatings) {
    rows.push(
      `Rating,${escapeCSV(rating.title)},${rating.type},${rating.rating}`,
    )
  }

  // Favorite People
  for (const person of favoritePersons) {
    rows.push(`Favorite Person,${escapeCSV(person.name)},Person,`)
  }

  const csvContent = rows.join("\n")
  downloadFile(csvContent, "showseek_export.csv", "text/csv")
}

// ============================================================================
// Markdown Export
// ============================================================================

/**
 * Export user data as Markdown per spec.md
 */
export async function exportToMarkdown(userId: string): Promise<void> {
  // Fetch all data in parallel
  const [lists, ratings, favoritePersons] = await Promise.all([
    fetchLists(userId),
    fetchRatings(userId),
    fetchFavoritePersons(userId),
  ])

  // Enrich ratings with TMDB titles
  const enrichedRatings = await enrichRatings(ratings)

  // Build Markdown content
  let md = "# ShowSeek Data Export\n\n"
  md += `_Exported on ${new Date().toLocaleDateString()}_\n\n`

  // -------------------------------------------------------------------------
  // Lists Section
  // -------------------------------------------------------------------------
  md += "## Lists\n\n"
  if (lists.length === 0) {
    md += "_No lists found_\n\n"
  } else {
    for (const list of lists) {
      md += `### ${list.name}\n`
      if (list.items && typeof list.items === "object") {
        const items = Object.values(list.items)
        if (items.length === 0) {
          md += "_No items_\n"
        } else {
          for (const item of items) {
            const title = item.title || item.name || "Unknown"
            const type = item.media_type === "movie" ? "Movie" : "TV"
            md += `- **${title}** (${type})\n`
          }
        }
      } else {
        md += "_No items_\n"
      }
      md += "\n"
    }
  }

  // -------------------------------------------------------------------------
  // Ratings Section
  // -------------------------------------------------------------------------
  md += "## Ratings\n\n"
  if (enrichedRatings.length === 0) {
    md += "_No ratings found_\n\n"
  } else {
    const movieRatings = enrichedRatings.filter((r) => r.type === "Movie")
    const tvRatings = enrichedRatings.filter((r) => r.type === "TV")
    const episodeRatings = enrichedRatings.filter((r) => r.type === "Episode")

    if (movieRatings.length > 0) {
      md += "### Movies\n"
      for (const r of movieRatings) {
        md += `- **${r.title}**: ${r.rating}/10\n`
      }
      md += "\n"
    }

    if (tvRatings.length > 0) {
      md += "### TV Shows\n"
      for (const r of tvRatings) {
        md += `- **${r.title}**: ${r.rating}/10\n`
      }
      md += "\n"
    }

    if (episodeRatings.length > 0) {
      md += "### Episodes\n"
      for (const r of episodeRatings) {
        md += `- **${r.title}**: ${r.rating}/10\n`
      }
      md += "\n"
    }
  }

  // -------------------------------------------------------------------------
  // Favorite People Section
  // -------------------------------------------------------------------------
  md += "## Favorite People\n\n"
  if (favoritePersons.length === 0) {
    md += "_No favorite people found_\n\n"
  } else {
    for (const person of favoritePersons) {
      md += `- **${person.name}**\n`
    }
    md += "\n"
  }

  downloadFile(md, "showseek_export.md", "text/markdown")
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Trigger browser download of a file
 */
function downloadFile(
  content: string,
  filename: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

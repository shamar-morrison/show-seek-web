/**
 * Export user data to CSV or Markdown format
 * Fetches all subcollections and generates downloadable files
 */

import { db } from "@/lib/firebase/config"
import { collection, getDocs } from "firebase/firestore"

interface ExportedData {
  ratings: Record<string, unknown>[]
  lists: Record<string, unknown>[]
  notes: Record<string, unknown>[]
  favoritePersons: Record<string, unknown>[]
  episodeTracking: Record<string, unknown>[]
}

/**
 * Fetch all user data from Firestore subcollections
 */
async function fetchAllUserData(userId: string): Promise<ExportedData> {
  const [ratings, lists, notes, favoritePersons, episodeTracking] =
    await Promise.all([
      getDocs(collection(db, "users", userId, "ratings")),
      getDocs(collection(db, "users", userId, "lists")),
      getDocs(collection(db, "users", userId, "notes")),
      getDocs(collection(db, "users", userId, "favorite_persons")),
      getDocs(collection(db, "users", userId, "episode_tracking")),
    ])

  return {
    ratings: ratings.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    lists: lists.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    notes: notes.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    favoritePersons: favoritePersons.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })),
    episodeTracking: episodeTracking.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })),
  }
}

/**
 * Convert array of objects to CSV string
 */
function arrayToCSV(data: Record<string, unknown>[], title: string): string {
  if (data.length === 0) {
    return `\n# ${title}\nNo data\n`
  }

  // Get all unique keys from all objects
  const allKeys = new Set<string>()
  data.forEach((item) => {
    Object.keys(item).forEach((key) => allKeys.add(key))
  })
  const headers = Array.from(allKeys)

  const rows = data.map((item) =>
    headers
      .map((header) => {
        const value = item[header]
        if (value === null || value === undefined) return ""
        if (typeof value === "object") return JSON.stringify(value)
        return String(value).includes(",")
          ? `"${String(value).replace(/"/g, '""')}"`
          : String(value)
      })
      .join(","),
  )

  return `\n# ${title}\n${headers.join(",")}\n${rows.join("\n")}\n`
}

/**
 * Export user data as CSV
 * Returns a single CSV file with sections for each collection
 */
export async function exportToCSV(userId: string): Promise<void> {
  const data = await fetchAllUserData(userId)

  let csvContent = "ShowSeek Data Export\n"
  csvContent += `Exported: ${new Date().toISOString()}\n`

  csvContent += arrayToCSV(data.ratings, "Ratings")
  csvContent += arrayToCSV(data.notes, "Notes")
  csvContent += arrayToCSV(data.favoritePersons, "Favorite People")

  // Handle lists specially - flatten items
  const flattenedLists: Record<string, unknown>[] = []
  data.lists.forEach((list) => {
    const listId = list.id
    const listName = list.name
    const items = list.items as Record<string, unknown> | undefined
    if (items && typeof items === "object") {
      Object.values(items).forEach((item) => {
        if (item && typeof item === "object") {
          flattenedLists.push({
            listId,
            listName,
            ...(item as Record<string, unknown>),
          })
        }
      })
    }
  })
  csvContent += arrayToCSV(flattenedLists, "Watch Lists")

  // Handle episode tracking - flatten episodes
  const flattenedEpisodes: Record<string, unknown>[] = []
  data.episodeTracking.forEach((show) => {
    const showId = show.id
    const showName = show.showName
    const posterPath = show.posterPath
    const episodes = show.episodes as Record<string, unknown> | undefined
    if (episodes && typeof episodes === "object") {
      Object.entries(episodes).forEach(([episodeKey, episode]) => {
        if (episode && typeof episode === "object") {
          flattenedEpisodes.push({
            showId,
            showName,
            posterPath,
            episodeKey,
            ...(episode as Record<string, unknown>),
          })
        }
      })
    }
  })
  csvContent += arrayToCSV(flattenedEpisodes, "Episode Tracking")

  downloadFile(csvContent, "showseek-export.csv", "text/csv")
}

/**
 * Format a rating for Markdown
 */
function formatRating(rating: Record<string, unknown>): string {
  const title = rating.title || rating.episodeName || "Unknown"
  const score = rating.rating
  const mediaType = rating.mediaType
  const date = rating.ratedAt
    ? new Date(rating.ratedAt as number).toLocaleDateString()
    : "Unknown"

  let line = `- **${title}**`
  if (mediaType === "episode" && rating.tvShowName) {
    line += ` (${rating.tvShowName} S${rating.seasonNumber}E${rating.episodeNumber})`
  }
  line += ` - ${score}/10 _(${date})_`
  return line
}

/**
 * Export user data as Markdown
 */
export async function exportToMarkdown(userId: string): Promise<void> {
  const data = await fetchAllUserData(userId)

  let md = "# ShowSeek Data Export\n\n"
  md += `_Exported: ${new Date().toLocaleString()}_\n\n`
  md += "---\n\n"

  // Ratings Section
  md += "## Ratings\n\n"
  if (data.ratings.length === 0) {
    md += "_No ratings yet_\n\n"
  } else {
    const movieRatings = data.ratings.filter((r) => r.mediaType === "movie")
    const tvRatings = data.ratings.filter((r) => r.mediaType === "tv")
    const episodeRatings = data.ratings.filter((r) => r.mediaType === "episode")

    if (movieRatings.length > 0) {
      md += "### Movies\n\n"
      movieRatings.forEach((r) => {
        md += formatRating(r) + "\n"
      })
      md += "\n"
    }

    if (tvRatings.length > 0) {
      md += "### TV Shows\n\n"
      tvRatings.forEach((r) => {
        md += formatRating(r) + "\n"
      })
      md += "\n"
    }

    if (episodeRatings.length > 0) {
      md += "### Episodes\n\n"
      episodeRatings.forEach((r) => {
        md += formatRating(r) + "\n"
      })
      md += "\n"
    }
  }

  // Lists Section
  md += "## Watch Lists\n\n"
  if (data.lists.length === 0) {
    md += "_No lists yet_\n\n"
  } else {
    data.lists.forEach((list) => {
      md += `### ${list.name || list.id}\n\n`
      const items = list.items as Record<string, unknown> | undefined
      if (items && typeof items === "object") {
        Object.values(items).forEach((item) => {
          if (item && typeof item === "object") {
            const i = item as Record<string, unknown>
            md += `- ${i.title || i.name || "Unknown"}`
            if (i.mediaType) md += ` _(${i.mediaType})_`
            md += "\n"
          }
        })
      } else {
        md += "_Empty list_\n"
      }
      md += "\n"
    })
  }

  // Notes Section
  md += "## Notes\n\n"
  if (data.notes.length === 0) {
    md += "_No notes yet_\n\n"
  } else {
    data.notes.forEach((note) => {
      md += `### ${note.title || "Untitled"}\n\n`
      md += `${note.content || ""}\n\n`
    })
  }

  // Favorite People Section
  md += "## Favorite People\n\n"
  if (data.favoritePersons.length === 0) {
    md += "_No favorites yet_\n\n"
  } else {
    data.favoritePersons.forEach((person) => {
      md += `- **${person.name}** _(${person.known_for_department || "Unknown"})_\n`
    })
    md += "\n"
  }

  // Episode Tracking Section
  md += "## Episode Tracking\n\n"
  if (data.episodeTracking.length === 0) {
    md += "_No tracked shows yet_\n\n"
  } else {
    data.episodeTracking.forEach((show) => {
      const episodes = show.episodes as Record<string, unknown> | undefined
      const watchedCount = episodes ? Object.keys(episodes).length : 0
      md += `- **${show.showName || show.id}** - ${watchedCount} episodes watched\n`
    })
    md += "\n"
  }

  downloadFile(md, "showseek-export.md", "text/markdown")
}

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

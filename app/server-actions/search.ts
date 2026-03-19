"use server"

import { multiSearch } from "@/lib/tmdb"

/**
 * Server action to search for media.
 * This wraps the server-only multiSearch function.
 */
export async function searchMedia(query: string) {
  try {
    return await multiSearch(query)
  } catch (error) {
    console.error("Server Action: Failed to search media", error)
    return { page: 1, results: [], total_pages: 0, total_results: 0 }
  }
}

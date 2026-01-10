/**
 * Trakt API Service
 * Server-side service for interacting with the Trakt API
 */

const TRAKT_API_URL = "https://api.trakt.tv"
const TRAKT_AUTH_URL = "https://trakt.tv"

/**
 * Get Trakt client configuration from environment
 */
function getTraktConfig() {
  const clientId = process.env.TRAKT_CLIENT_ID
  const redirectUri =
    process.env.TRAKT_REDIRECT_URI || "http://localhost:3000/api/trakt/callback"

  if (!clientId) {
    throw new Error("TRAKT_CLIENT_ID environment variable is not set")
  }

  return { clientId, redirectUri }
}

/**
 * Build the Trakt OAuth authorization URL
 */
export function getAuthorizationUrl(userId: string): string {
  const { clientId, redirectUri } = getTraktConfig()

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state: userId, // Pass userId in state for callback identification
  })

  return `${TRAKT_AUTH_URL}/oauth/authorize?${params.toString()}`
}

/**
 * Exchange authorization code for access token
 * Note: No client_secret is sent for Native apps
 */
export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
  created_at: number
}> {
  const { clientId, redirectUri } = getTraktConfig()

  const response = await fetch(`${TRAKT_API_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      // Note: No client_secret for Native apps
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to exchange code for token: ${error}`)
  }

  return response.json()
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
  created_at: number
}> {
  const { clientId, redirectUri } = getTraktConfig()

  const response = await fetch(`${TRAKT_API_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refresh_token: refreshToken,
      client_id: clientId,
      redirect_uri: redirectUri,
      grant_type: "refresh_token",
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to refresh token: ${error}`)
  }

  return response.json()
}

/**
 * Make an authenticated request to the Trakt API
 */
async function traktFetch(
  endpoint: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<Response> {
  const { clientId } = getTraktConfig()

  const response = await fetch(`${TRAKT_API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "trakt-api-version": "2",
      "trakt-api-key": clientId,
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  })

  return response
}

// Type definitions for Trakt API responses
export interface TraktIds {
  trakt: number
  slug?: string
  imdb?: string
  tmdb?: number
  tvdb?: number
}

export interface TraktMovie {
  title: string
  year: number
  ids: TraktIds
}

export interface TraktShow {
  title: string
  year: number
  ids: TraktIds
}

export interface TraktEpisode {
  season: number
  number: number
  title: string
  ids: TraktIds
}

export interface TraktHistoryItem {
  id: number
  watched_at: string
  action: string
  type: "movie" | "episode"
  movie?: TraktMovie
  show?: TraktShow
  episode?: TraktEpisode
}

export interface TraktRatingItem {
  rated_at: string
  rating: number
  type: "movie" | "show" | "episode"
  movie?: TraktMovie
  show?: TraktShow
  episode?: TraktEpisode
}

export interface TraktWatchlistItem {
  rank: number
  listed_at: string
  type: "movie" | "show"
  movie?: TraktMovie
  show?: TraktShow
}

/**
 * Fetch user's watch history from Trakt with pagination support.
 * Uses a reasonable cap to prevent runaway syncs for users with very large histories.
 */
export async function getHistory(
  accessToken: string,
  type: "movies" | "shows" | "episodes" = "movies",
  limit = 1000,
): Promise<TraktHistoryItem[]> {
  const MAX_PAGES = 10 // Cap at 10 pages (10,000 items with limit=1000)
  const allItems: TraktHistoryItem[] = []
  let currentPage = 1
  let totalPages = 1

  while (currentPage <= totalPages && currentPage <= MAX_PAGES) {
    const response = await traktFetch(
      `/sync/history/${type}?page=${currentPage}&limit=${limit}`,
      accessToken,
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch history: ${response.statusText}`)
    }

    // Get pagination info from headers on first request
    if (currentPage === 1) {
      const pageCountHeader = response.headers.get("X-Pagination-Page-Count")
      if (pageCountHeader) {
        totalPages = parseInt(pageCountHeader, 10)
      } else {
        // Header missing: treat as unknown, fallback to MAX_PAGES
        totalPages = MAX_PAGES
      }
    }

    const items: TraktHistoryItem[] = await response.json()
    allItems.push(...items)

    // If we got fewer items than the limit, we've reached the end
    if (items.length < limit) {
      break
    }

    currentPage++
  }

  return allItems
}

/**
 * Fetch user's ratings from Trakt
 */
export async function getRatings(
  accessToken: string,
  type: "movies" | "shows" | "episodes" = "movies",
): Promise<TraktRatingItem[]> {
  const response = await traktFetch(`/sync/ratings/${type}`, accessToken)

  if (!response.ok) {
    throw new Error(`Failed to fetch ratings: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Fetch user's watchlist from Trakt
 */
export async function getWatchlist(
  accessToken: string,
  type: "movies" | "shows" = "movies",
): Promise<TraktWatchlistItem[]> {
  const response = await traktFetch(`/sync/watchlist/${type}`, accessToken)

  if (!response.ok) {
    throw new Error(`Failed to fetch watchlist: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Revoke a Trakt access token
 */
export async function revokeToken(accessToken: string): Promise<void> {
  const { clientId } = getTraktConfig()

  await fetch(`${TRAKT_API_URL}/oauth/revoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token: accessToken,
      client_id: clientId,
    }),
  })
}

// Custom Lists types
export interface TraktList {
  name: string
  description: string
  ids: {
    trakt: number
    slug: string
  }
  item_count: number
  likes: number
  created_at: string
  updated_at: string
}

export interface TraktListItem {
  rank: number
  listed_at: string
  type: "movie" | "show"
  movie?: TraktMovie
  show?: TraktShow
}

/**
 * Fetch user's custom lists from Trakt
 */
export async function getUserLists(accessToken: string): Promise<TraktList[]> {
  const response = await traktFetch("/users/me/lists", accessToken)

  if (!response.ok) {
    throw new Error(`Failed to fetch lists: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Fetch items in a specific user list
 */
export async function getListItems(
  accessToken: string,
  listSlug: string,
): Promise<TraktListItem[]> {
  const response = await traktFetch(
    `/users/me/lists/${listSlug}/items`,
    accessToken,
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch list items: ${response.statusText}`)
  }

  return response.json()
}

/** Type of list for home screen customization */
export type HomeListType = "tmdb" | "default" | "custom"

/** Configuration for a single home screen list item */
export interface HomeScreenListItem {
  id: string
  type: HomeListType
  label: string
}

export interface UserPreferences {
  autoAddToWatching: boolean
  autoAddToAlreadyWatched: boolean
  autoRemoveFromShouldWatch: boolean
  markPreviousEpisodesWatched: boolean
  showListIndicators: boolean
  showOriginalTitles: boolean
  blurPlotSpoilers: boolean
  showMediaPreviewCards: boolean
  quickMarkAsWatched: boolean
  hideWatchedContent: boolean
  hideUnreleasedContent: boolean
  homeScreenLists?: HomeScreenListItem[]
}

/** Legacy Firestore shape kept for read compatibility during migration. */
export type StoredUserPreferences = Partial<UserPreferences> & {
  autoRemoveWatchedFromWatchlist?: boolean
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  autoAddToWatching: false,
  autoAddToAlreadyWatched: false,
  autoRemoveFromShouldWatch: true,
  markPreviousEpisodesWatched: false,
  showListIndicators: false,
  showOriginalTitles: false,
  blurPlotSpoilers: false,
  showMediaPreviewCards: false,
  quickMarkAsWatched: false,
  hideWatchedContent: false,
  hideUnreleasedContent: false,
}

export function hydrateUserPreferences(
  storedPreferences?: StoredUserPreferences,
): UserPreferences {
  const { autoRemoveFromShouldWatch, autoRemoveWatchedFromWatchlist, ...rest } =
    storedPreferences ?? {}

  return {
    ...DEFAULT_PREFERENCES,
    ...rest,
    autoRemoveFromShouldWatch:
      autoRemoveFromShouldWatch ??
      autoRemoveWatchedFromWatchlist ??
      DEFAULT_PREFERENCES.autoRemoveFromShouldWatch,
  }
}

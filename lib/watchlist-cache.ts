import { queryKeys } from "@/lib/react-query/query-keys"
import { hasStoredListItem } from "@/lib/list-item-keys"
import type { UserList } from "@/types/list"
import type { QueryClient } from "@tanstack/react-query"

export function isMovieInCachedWatchlist(
  queryClient: QueryClient,
  userId: string | null,
  movieId: number,
): boolean {
  if (!userId) return false

  const lists = queryClient.getQueryData<UserList[]>(
    queryKeys.firestore.lists(userId),
  )
  const watchlist = lists?.find((list) => list.id === "watchlist")

  return hasStoredListItem(watchlist?.items, "movie", movieId)
}

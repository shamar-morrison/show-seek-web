import { queryKeys } from "@/lib/react-query/query-keys"
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

  if (!watchlist?.items) return false

  return Object.hasOwn(watchlist.items, String(movieId))
}

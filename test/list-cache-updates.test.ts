import { addItemToCachedLists } from "@/lib/list-cache-updates"
import type { ListWriteMediaItem, UserList } from "@/types/list"
import { describe, expect, it } from "vitest"

function createBaseLists(): UserList[] {
  return [
    {
      id: "watchlist",
      name: "Should Watch",
      items: {},
      createdAt: 0,
      isCustom: false,
    },
  ]
}

function createMediaItem(
  mediaType: "movie" | "tv",
  id = 123,
): ListWriteMediaItem {
  return {
    id,
    media_type: mediaType,
    title: mediaType === "movie" ? "Movie Title" : "TV Title",
    poster_path: null,
    addedAt: 100,
  }
}

describe("addItemToCachedLists", () => {
  it("stores movie and tv items with the same numeric id under distinct keys", () => {
    const withMovie = addItemToCachedLists(
      createBaseLists(),
      "watchlist",
      createMediaItem("movie"),
    )
    const withMovieAndTv = addItemToCachedLists(
      withMovie,
      "watchlist",
      createMediaItem("tv"),
    )

    expect(withMovieAndTv[0]?.items).toEqual(
      expect.objectContaining({
        "movie-123": expect.objectContaining({
          id: 123,
          media_type: "movie",
        }),
        "tv-123": expect.objectContaining({
          id: 123,
          media_type: "tv",
        }),
      }),
    )
  })
})

import { listItemToMedia } from "@/lib/list-media"
import { describe, expect, it } from "vitest"

describe("listItemToMedia", () => {
  it("rehydrates movie titles without overwriting the original title", () => {
    const media = listItemToMedia({
      id: 12,
      title: "Spirited Away",
      original_title: "Sen to Chihiro no Kamikakushi",
      poster_path: "/poster.jpg",
      media_type: "movie",
      vote_average: 8.6,
      release_date: "2001-07-20",
      addedAt: 1,
    })

    expect(media.title).toBe("Spirited Away")
    expect(media.original_title).toBe("Sen to Chihiro no Kamikakushi")
    expect(media.name).toBeUndefined()
    expect(media.media_type).toBe("movie")
  })

  it("rehydrates tv titles without overwriting the original name", () => {
    const media = listItemToMedia({
      id: 34,
      title: "Money Heist",
      name: "Money Heist",
      original_name: "La casa de papel",
      poster_path: "/poster.jpg",
      media_type: "tv",
      vote_average: 8.2,
      first_air_date: "2017-05-02",
      addedAt: 1,
    })

    expect(media.name).toBe("Money Heist")
    expect(media.original_name).toBe("La casa de papel")
    expect(media.title).toBeUndefined()
    expect(media.media_type).toBe("tv")
  })
})

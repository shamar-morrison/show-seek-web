import {
  buildOpenWithFallbackUrl,
  buildOpenWithUrl,
  OPEN_WITH_SERVICES,
} from "@/lib/open-with-links"
import { describe, expect, it } from "vitest"

describe("open-with-links", () => {
  it("exposes all eight mobile services in order", () => {
    expect(OPEN_WITH_SERVICES.map((service) => service.id)).toEqual([
      "imdb",
      "trakt",
      "tmdb",
      "letterboxd",
      "rottenTomatoes",
      "metacritic",
      "wikipedia",
      "webSearch",
    ])
  })

  it("builds direct title links when IDs are known", () => {
    expect(
      buildOpenWithUrl({
        serviceId: "imdb",
        mediaType: "movie",
        mediaId: 123,
        title: "Inception",
        year: "2010",
        imdbId: "tt1375666",
        traktSlug: null,
      }),
    ).toBe("https://www.imdb.com/title/tt1375666/")

    expect(
      buildOpenWithUrl({
        serviceId: "trakt",
        mediaType: "tv",
        mediaId: 456,
        title: "Severance",
        year: "2022",
        imdbId: null,
        traktSlug: "severance",
      }),
    ).toBe("https://trakt.tv/shows/severance")

    expect(
      buildOpenWithUrl({
        serviceId: "tmdb",
        mediaType: "movie",
        mediaId: 123,
        title: "Inception",
        year: "2010",
        imdbId: null,
        traktSlug: null,
      }),
    ).toBe("https://www.themoviedb.org/movie/123")
  })

  it("falls back to search URLs when IDs are unknown", () => {
    expect(
      buildOpenWithUrl({
        serviceId: "imdb",
        mediaType: "movie",
        mediaId: 123,
        title: "Inception",
        year: "2010",
        imdbId: null,
        traktSlug: null,
      }),
    ).toBe("https://www.imdb.com/find/?q=Inception%202010&s=tt")

    expect(
      buildOpenWithUrl({
        serviceId: "trakt",
        mediaType: "movie",
        mediaId: 123,
        title: "Inception",
        year: "2010",
        imdbId: null,
        traktSlug: null,
      }),
    ).toBe("https://app.trakt.tv/search?m=movie&q=Inception%202010")

    expect(
      buildOpenWithUrl({
        serviceId: "trakt",
        mediaType: "tv",
        mediaId: 456,
        title: "Severance",
        year: "2022",
        imdbId: null,
        traktSlug: null,
      }),
    ).toBe("https://app.trakt.tv/search?m=show&q=Severance%202022")

    expect(
      buildOpenWithFallbackUrl({
        serviceId: "letterboxd",
        mediaType: "movie",
        title: "Inception",
        year: "2010",
      }),
    ).toBe("https://letterboxd.com/search/Inception%202010/")
  })

  it("omits the year from search queries when unknown", () => {
    expect(
      buildOpenWithFallbackUrl({
        serviceId: "webSearch",
        mediaType: "tv",
        title: "Severance",
        year: null,
      }),
    ).toBe("https://www.google.com/search?q=Severance")
  })
})

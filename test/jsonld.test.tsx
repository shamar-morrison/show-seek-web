import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

vi.mock("@/lib/tmdb", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/tmdb")>()
  return {
    ...original,
    buildImageUrl: (path: string | null, size: string = "original") =>
      path ? `https://image.tmdb.org/t/p/${size}${path}` : null,
  }
})

import {
  itemListSchema,
  movieDetailSchema,
  serializeJsonLd,
  tvSeriesDetailSchema,
  websiteSchema,
} from "../lib/jsonld"
import { JsonLd } from "../components/json-ld"
import { renderToStaticMarkup } from "react-dom/server"

const baseMovie = {
  id: 27205,
  title: "Inception",
  original_title: "Inception",
  original_language: "en",
  overview: "A thief who steals corporate secrets.",
  poster_path: "/poster.jpg",
  backdrop_path: "/backdrop.jpg",
  release_date: "2010-07-16",
  runtime: 148,
  vote_average: 8.369,
  vote_count: 38000,
  genres: [
    { id: 28, name: "Action" },
    { id: 878, name: "Science Fiction" },
  ],
  status: "Released",
  tagline: null,
  adult: false,
  budget: 160000000,
  homepage: null,
  imdb_id: "tt1375666",
  revenue: 800000000,
  video: false,
  production_companies: [{ id: 1, name: "Warner Bros.", logo_path: null, origin_country: "US" }],
  production_countries: [],
  spoken_languages: [],
  belongs_to_collection: null,
  credits: {
    id: 27205,
    cast: [
      { id: 1, name: "Leonardo DiCaprio", character: "Cobb", profile_path: null, order: 0 },
      { id: 2, name: "Joseph Gordon-Levitt", character: "Arthur", profile_path: null, order: 1 },
    ],
    crew: [
      { id: 3, name: "Christopher Nolan", job: "Director", department: "Directing", profile_path: null },
      { id: 4, name: "Hans Zimmer", job: "Original Music Composer", department: "Sound", profile_path: null },
    ],
  },
}

const baseTvShow = {
  id: 1396,
  name: "Breaking Bad",
  original_name: "Breaking Bad",
  original_language: "en",
  overview: "A chemistry teacher turns meth kingpin.",
  poster_path: "/tvposter.jpg",
  backdrop_path: "/tvbackdrop.jpg",
  first_air_date: "2008-01-20",
  last_air_date: "2013-09-29",
  episode_run_time: [45],
  vote_average: 8.9,
  vote_count: 15000,
  genres: [{ id: 18, name: "Drama" }],
  status: "Ended",
  tagline: null,
  number_of_seasons: 5,
  number_of_episodes: 62,
  in_production: false,
  languages: ["en"],
  origin_country: ["US"],
  networks: [],
  last_episode_to_air: null,
  next_episode_to_air: null,
  seasons: [],
  created_by: [{ id: 5, name: "Vince Gilligan", profile_path: null }],
  production_companies: [],
  production_countries: [],
  spoken_languages: [],
  credits: {
    id: 1396,
    cast: [
      { id: 6, name: "Bryan Cranston", character: "Walter White", profile_path: null, order: 0 },
    ],
    crew: [],
  },
}

describe("websiteSchema", () => {
  it("emits WebSite with a SearchAction targeting internal search", () => {
    const schema = websiteSchema()
    expect(schema["@context"]).toBe("https://schema.org")
    expect(schema["@type"]).toBe("WebSite")
    const action = schema.potentialAction as Record<string, unknown>
    expect(action["@type"]).toBe("SearchAction")
    const target = action.target as Record<string, unknown>
    expect(target["@type"]).toBe("EntryPoint")
    expect(target.urlTemplate).toBe(
      "https://show-seek.app/search?q={search_term_string}",
    )
    expect(action["query-input"]).toBe("required name=search_term_string")
  })
})

describe("movieDetailSchema", () => {
  it("maps TMDB fields to Movie properties", () => {
    const schema = movieDetailSchema(baseMovie, "trailer123") as Record<string, unknown>
    expect(schema["@type"]).toBe("Movie")
    expect(schema.name).toBe("Inception")
    expect(schema.description).toBe("A thief who steals corporate secrets.")
    expect(schema.url).toBe("https://show-seek.app/movie/27205")
    expect(schema.image).toBe("https://image.tmdb.org/t/p/original/poster.jpg")
    expect(schema.datePublished).toBe("2010-07-16")
    expect(schema.genre).toEqual(["Action", "Science Fiction"])
    expect(schema.inLanguage).toBe("en")
    expect(schema.duration).toBe("PT148M")
    expect(schema.aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: 8.4,
      ratingCount: 38000,
      bestRating: 10,
    })
    expect(schema.actor).toEqual([
      { "@type": "Person", name: "Leonardo DiCaprio" },
      { "@type": "Person", name: "Joseph Gordon-Levitt" },
    ])
    // Only the Directing/ Director crew member qualifies (not the composer).
    expect(schema.director).toEqual([
      { "@type": "Person", name: "Christopher Nolan" },
    ])
    const trailer = schema.trailer as Record<string, unknown>
    expect(trailer["@type"]).toBe("VideoObject")
    expect(trailer.embedUrl).toBe("https://www.youtube.com/embed/trailer123")
  })

  it("omits aggregateRating when there are no votes and trailer when missing", () => {
    const schema = movieDetailSchema(
      { ...baseMovie, vote_average: 0, vote_count: 0, runtime: null },
      null,
    ) as Record<string, unknown>
    expect(schema).not.toHaveProperty("aggregateRating")
    expect(schema).not.toHaveProperty("trailer")
    expect(schema).not.toHaveProperty("duration")
  })

  it("serializes without undefined values", () => {
    const schema = movieDetailSchema(
      {
        ...baseMovie,
        overview: "",
        tagline: null,
        poster_path: null,
        backdrop_path: null,
        release_date: "",
        genres: [],
        original_language: "",
        production_companies: [],
        credits: { id: 1, cast: [], crew: [] },
      },
      null,
    )
    const json = JSON.parse(JSON.stringify(schema)) as Record<string, unknown>
    for (const value of Object.values(json)) {
      expect(value).not.toBeUndefined()
    }
    expect(json).not.toHaveProperty("image")
    expect(json).not.toHaveProperty("actor")
  })
})

describe("tvSeriesDetailSchema", () => {
  it("maps TMDB fields to TVSeries properties", () => {
    const schema = tvSeriesDetailSchema(baseTvShow, null) as Record<string, unknown>
    expect(schema["@type"]).toBe("TVSeries")
    expect(schema.name).toBe("Breaking Bad")
    expect(schema.url).toBe("https://show-seek.app/tv/1396")
    expect(schema.datePublished).toBe("2008-01-20")
    expect(schema.numberOfSeasons).toBe(5)
    expect(schema.numberOfEpisodes).toBe(62)
    expect(schema.creator).toEqual([
      { "@type": "Person", name: "Vince Gilligan" },
    ])
    expect(schema.actor).toEqual([
      { "@type": "Person", name: "Bryan Cranston" },
    ])
    expect(schema).not.toHaveProperty("trailer")
  })
})

describe("itemListSchema", () => {
  it("lists titles with positions and detail-page URLs, skipping non-titles", () => {
    const schema = itemListSchema({
      name: "Trending TV Shows",
      description: "Discover trending TV shows on ShowSeek",
      baseUrl: "/trending-tv",
      page: 1,
      items: [
        { id: 1, media_type: "tv", name: "Show One" },
        { id: 2, media_type: "movie", title: "Movie Two" },
        { id: 3, media_type: "person", name: "Not A Title" },
      ],
    })
    expect(schema["@type"]).toBe("ItemList")
    expect(schema.url).toBe("https://show-seek.app/trending-tv")
    expect(schema.numberOfItems).toBe(2)
    expect(schema.itemListElement).toEqual([
      {
        "@type": "ListItem",
        position: 1,
        name: "Show One",
        url: "https://show-seek.app/tv/1",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Movie Two",
        url: "https://show-seek.app/movie/2",
      },
    ])
  })

  it("points page 2+ at the paginated URL", () => {
    const schema = itemListSchema({
      name: "Popular Movies",
      description: "Discover popular movies on ShowSeek",
      baseUrl: "/popular-movies",
      page: 3,
      items: [{ id: 10, media_type: "movie", title: "Movie Ten" }],
    })
    expect(schema.url).toBe("https://show-seek.app/popular-movies?page=3")
  })
})

describe("serializeJsonLd", () => {
  it("escapes tag breakouts while round-tripping as valid JSON-LD", () => {
    const payload = {
      "@context": "https://schema.org",
      "@type": "Movie",
      name: 'Evil</script><script>alert("xss")</script> & Friends',
      description: "5 > 3 & 2 < 4",
    }
    const serialized = serializeJsonLd(payload)
    // No literal tag open/close may survive (prevents script breakout).
    expect(serialized).not.toContain("</script>")
    expect(serialized).not.toContain("<script>")
    expect(serialized).toContain("\\u003c/script\\u003e")
    // Escapes decode transparently: the structured data is unchanged.
    expect(JSON.parse(serialized)).toEqual(payload)
  })
})

describe("JsonLd component", () => {
  it("renders a single script tag with escaped, parseable payload", () => {
    const payload = {
      "@type": "Movie",
      name: "Bad</script> Title",
    }
    const html = renderToStaticMarkup(<JsonLd data={payload} />)
    // Exactly one closing tag: the script element's own.
    expect(html.indexOf("</script>")).toBe(html.lastIndexOf("</script>"))
    const inner = html
      .replace(/^<script type="application\/ld\+json">/, "")
      .replace(/<\/script>$/, "")
    expect(JSON.parse(inner)).toEqual(payload)
  })
})

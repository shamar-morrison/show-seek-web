import { MediaRow } from "@/components/media-row"
import { render, screen } from "@/test/utils"
import type { TMDBMedia } from "@/types/tmdb"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  useContentFilter: vi.fn((items: TMDBMedia[]) => items),
}))

vi.mock("@/hooks/use-content-filter", () => ({
  useContentFilter: (items: TMDBMedia[]) => mocks.useContentFilter(items),
}))

vi.mock("@/components/media-card", () => ({
  MediaCard: ({ media }: { media: TMDBMedia }) => (
    <div data-testid="media-card">{`${media.media_type}-${media.id}`}</div>
  ),
}))

vi.mock("@/components/media-card-with-actions", () => ({
  MediaCardWithActions: ({ media }: { media: TMDBMedia }) => (
    <div data-testid="media-card-with-actions">{`${media.media_type}-${media.id}`}</div>
  ),
}))

vi.mock("@/components/ui/scrollable-row", () => ({
  ScrollableRow: ({ children }: { children: ReactNode }) => (
    <div data-testid="scrollable-row">{children}</div>
  ),
}))

vi.mock("@/components/ui/section", () => ({
  Section: ({
    title,
    headerExtra,
    children,
  }: {
    title: string
    headerExtra?: ReactNode
    children: ReactNode
  }) => (
    <section>
      <h2>{title}</h2>
      {headerExtra}
      {children}
    </section>
  ),
}))

vi.mock("@/components/ui/view-all-link", () => ({
  ViewAllLink: ({ href }: { href: string }) => <a href={href}>View all</a>,
}))

function createMedia(
  overrides: Partial<TMDBMedia> & Pick<TMDBMedia, "id" | "media_type">,
): TMDBMedia {
  const { id, media_type, ...restOverrides } = overrides

  return {
    id,
    media_type,
    adult: false,
    backdrop_path: null,
    poster_path: null,
    title: media_type === "movie" ? "Movie Title" : undefined,
    name: media_type === "tv" ? "TV Title" : undefined,
    original_title: undefined,
    original_name: undefined,
    overview: "Overview",
    genre_ids: [],
    popularity: 1,
    release_date: media_type === "movie" ? "2024-01-01" : undefined,
    first_air_date: media_type === "tv" ? "2024-01-01" : undefined,
    vote_average: 8,
    vote_count: 100,
    original_language: "en",
    ...restOverrides,
  }
}

describe("MediaRow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useContentFilter.mockImplementation((items: TMDBMedia[]) => items)
  })

  it("deduplicates media items before filtering and rendering", () => {
    const first = createMedia({ id: 69478, media_type: "tv", name: "Show Seek" })
    const duplicate = createMedia({
      id: 69478,
      media_type: "tv",
      name: "Show Seek Duplicate",
      vote_count: 200,
    })
    const second = createMedia({
      id: 42,
      media_type: "movie",
      title: "The Answer",
    })

    render(<MediaRow title="Featured" items={[first, duplicate, second]} />)

    expect(mocks.useContentFilter).toHaveBeenCalledTimes(1)
    expect(mocks.useContentFilter).toHaveBeenCalledWith([first, second])
    expect(screen.getAllByTestId("media-card")).toHaveLength(2)
    expect(screen.getByText("tv-69478")).toBeInTheDocument()
    expect(screen.getByText("movie-42")).toBeInTheDocument()
  })
})

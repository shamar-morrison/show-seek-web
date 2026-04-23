import { describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"

import { fireEvent, render, screen, within } from "./utils"

import { ReleaseCalendarView } from "@/components/release-calendar-page-client"
import type { ReleaseCalendarRelease } from "@/types/release-calendar"

vi.mock("@/components/ui/filter-sort", () => ({
  FilterSort: ({
    onClearAll,
    onMultiFilterChange,
    onSortChange,
    triggerLabel,
    triggerTestId,
  }: {
    onClearAll?: () => void
    onMultiFilterChange?: (key: string, values: string[]) => void
    onSortChange: (state: { field: string; direction: "asc" | "desc" }) => void
    triggerLabel?: string
    triggerTestId?: string
  }) => (
    <div>
      <button type="button" data-testid={triggerTestId}>
        {triggerLabel}
      </button>
      <button
        type="button"
        onClick={() => onMultiFilterChange?.("source", ["favorites"])}
      >
        Filter Favorites
      </button>
      <button
        type="button"
        onClick={() => onSortChange({ field: "type", direction: "asc" })}
      >
        Sort By Type
      </button>
      <button type="button" onClick={onClearAll}>
        Clear Shared Filters
      </button>
    </div>
  ),
}))

function createRelease(
  overrides: Partial<ReleaseCalendarRelease>,
): ReleaseCalendarRelease {
  const mediaType = overrides.mediaType ?? "movie"
  const id = overrides.id ?? 1
  const nextEpisode = overrides.nextEpisode

  return {
    id,
    mediaType,
    title: overrides.title ?? "Release",
    posterPath: null,
    backdropPath: null,
    releaseDate: overrides.releaseDate ?? "2099-04-10",
    nextEpisode,
    sourceLists: overrides.sourceLists ?? ["watchlist"],
    uniqueKey:
      overrides.uniqueKey ??
      (mediaType === "tv" && nextEpisode
        ? `tv-${id}-s${nextEpisode.seasonNumber}-e${nextEpisode.episodeNumber}`
        : `${mediaType}-${id}`),
  }
}

function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

describe("ReleaseCalendarView", () => {
  it("renders a responsive two-column card list with grouped TV episodes and shared media tabs", async () => {
    const user = userEvent.setup()

    render(
      <ReleaseCalendarView
        releases={[
          createRelease({
            id: 1,
            title: "Alpha",
            releaseDate: "2099-04-10",
            uniqueKey: "movie-1",
          }),
          createRelease({
            id: 2,
            mediaType: "tv",
            title: "Beta",
            releaseDate: "2099-04-12",
            uniqueKey: "tv-2-s1-e1",
            sourceLists: ["currently-watching"],
            nextEpisode: {
              seasonNumber: 1,
              episodeNumber: 1,
              episodeName: "Pilot",
            },
          }),
          createRelease({
            id: 2,
            mediaType: "tv",
            title: "Beta",
            releaseDate: "2099-04-13",
            uniqueKey: "tv-2-s1-e2",
            sourceLists: ["currently-watching"],
            nextEpisode: {
              seasonNumber: 1,
              episodeNumber: 2,
              episodeName: "Second",
            },
          }),
          createRelease({
            id: 3,
            title: "Gamma",
            releaseDate: "2099-05-01",
            uniqueKey: "movie-3",
          }),
        ]}
        isPremium
      />,
    )

    expect(screen.getByText("Alpha")).toBeInTheDocument()
    expect(screen.getByText("Beta")).toBeInTheDocument()
    expect(screen.getByText("Gamma")).toBeInTheDocument()
    expect(
      screen.getByText(/Season 1 Episode\s+1 \/ Pilot/),
    ).toBeInTheDocument()
    expect(screen.queryByText("2 upcoming episodes")).not.toBeInTheDocument()
    expect(screen.queryByText("Second")).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "2 episodes ↓" }),
    ).toBeInTheDocument()
    const cardGrid = screen.getByTestId("release-calendar-card-grid")
    expect(cardGrid).toHaveClass("space-y-6")
    expect(cardGrid).not.toHaveClass("columns-1")
    expect(cardGrid).not.toHaveClass("gap-x-4")
    expect(cardGrid).not.toHaveClass("lg:columns-2")
    expect(cardGrid.className).not.toContain("grid")
    expect(cardGrid.className).not.toContain("grid-cols")

    const getReleaseSection = (headingName: string) => {
      const heading = screen.getByRole("heading", { name: headingName })
      const headingRow = heading.closest("div")
      const section = headingRow?.parentElement

      expect(headingRow?.className).not.toContain("column-span")
      expect(section).toBeInstanceOf(HTMLElement)

      return section as HTMLElement
    }

    const aprilSection = getReleaseSection("April 2099")
    const aprilGrid = aprilSection.children.item(1) as HTMLElement
    const alphaCard = aprilGrid.children.item(0) as HTMLElement
    const betaCard = aprilGrid.children.item(1) as HTMLElement

    expect(aprilGrid).toHaveClass(
      "grid",
      "grid-cols-1",
      "gap-4",
      "lg:grid-cols-2",
    )
    expect(aprilGrid).not.toHaveClass("flex", "lg:flex-row")
    expect(aprilGrid.children).toHaveLength(2)
    expect(within(alphaCard).getByText("Alpha")).toBeInTheDocument()
    expect(within(alphaCard).queryByText("Beta")).not.toBeInTheDocument()
    expect(within(betaCard).getByText("Beta")).toBeInTheDocument()
    expect(within(betaCard).queryByText("Alpha")).not.toBeInTheDocument()

    const maySection = getReleaseSection("May 2099")

    expect(within(maySection).getByText("Gamma")).toBeInTheDocument()
    expect(within(maySection).queryByText("Alpha")).not.toBeInTheDocument()
    expect(
      aprilSection.compareDocumentPosition(maySection) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    const cards = screen.getAllByTestId("release-calendar-card")
    expect(cards).toHaveLength(3)
    cards.forEach((card) => {
      expect(card).not.toHaveClass("break-inside-avoid")
      expect(card).not.toHaveClass("mb-4")
    })
    expect(screen.queryByText(/releases in view/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Showing \d+ of/i)).not.toBeInTheDocument()
    expect(
      screen.getByTestId("release-calendar-card-grid").parentElement?.className,
    ).not.toContain("border")

    await user.click(screen.getByTestId("release-calendar-media-tab-tv"))

    expect(screen.queryByText("Alpha")).not.toBeInTheDocument()
    expect(screen.getByText("Beta")).toBeInTheDocument()
    expect(screen.queryByText("Gamma")).not.toBeInTheDocument()
  })

  it("collapses grouped episode rows below the divider until expanded", async () => {
    const user = userEvent.setup()

    render(
      <ReleaseCalendarView
        releases={[
          createRelease({
            id: 7,
            mediaType: "tv",
            title: "Long Show",
            releaseDate: "2099-04-12",
            uniqueKey: "tv-7-s1-e1",
            sourceLists: ["currently-watching"],
            nextEpisode: {
              seasonNumber: 1,
              episodeNumber: 1,
              episodeName: "First",
            },
          }),
          createRelease({
            id: 7,
            mediaType: "tv",
            title: "Long Show",
            releaseDate: "2099-04-13",
            uniqueKey: "tv-7-s1-e2",
            sourceLists: ["currently-watching"],
            nextEpisode: {
              seasonNumber: 1,
              episodeNumber: 2,
              episodeName: "Second",
            },
          }),
          createRelease({
            id: 7,
            mediaType: "tv",
            title: "Long Show",
            releaseDate: "2099-04-14",
            uniqueKey: "tv-7-s1-e3",
            sourceLists: ["currently-watching"],
            nextEpisode: {
              seasonNumber: 1,
              episodeNumber: 3,
              episodeName: "Third",
            },
          }),
        ]}
        isPremium
      />,
    )

    expect(
      screen.getByText(/Season 1 Episode\s+1 \/ First/),
    ).toBeInTheDocument()
    expect(screen.queryByText("3 upcoming episodes")).not.toBeInTheDocument()
    expect(screen.queryByText("First")).not.toBeInTheDocument()
    expect(screen.queryByText("Second")).not.toBeInTheDocument()
    expect(screen.queryByText("Third")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "3 episodes ↓" }))

    expect(screen.getByText("First")).toBeInTheDocument()
    expect(screen.getByText("Second")).toBeInTheDocument()
    expect(screen.getByText("Third")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Show less ↑" })).toHaveAttribute(
      "aria-expanded",
      "true",
    )

    await user.click(screen.getByRole("button", { name: "Show less ↑" }))

    expect(screen.queryByText("First")).not.toBeInTheDocument()
    expect(screen.queryByText("Second")).not.toBeInTheDocument()
    expect(screen.queryByText("Third")).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "3 episodes ↓" }),
    ).toHaveAttribute("aria-expanded", "false")
  })

  it("shows one visible grouped episode row without a toggle after temporal filtering", () => {
    const today = new Date()
    const companionDate = new Date(today)

    if (today.getDate() === 1) {
      companionDate.setDate(2)
    } else {
      companionDate.setDate(today.getDate() - 1)
    }

    render(
      <ReleaseCalendarView
        releases={[
          createRelease({
            id: 8,
            mediaType: "tv",
            title: "Filtered Show",
            releaseDate: formatLocalDateKey(today),
            uniqueKey: "tv-8-s4-e2",
            sourceLists: ["currently-watching"],
            nextEpisode: {
              seasonNumber: 4,
              episodeNumber: 2,
              episodeName: "Fray",
            },
          }),
          createRelease({
            id: 8,
            mediaType: "tv",
            title: "Filtered Show",
            releaseDate: formatLocalDateKey(companionDate),
            uniqueKey: "tv-8-s4-e3",
            sourceLists: ["currently-watching"],
            nextEpisode: {
              seasonNumber: 4,
              episodeNumber: 3,
              episodeName: "After",
            },
          }),
        ]}
        isPremium
      />,
    )

    fireEvent.click(screen.getByTestId("release-calendar-temporal-tab-today"))

    expect(screen.getByText(/Season 4 Episode\s+2 \/ Fray/)).toBeInTheDocument()
    expect(screen.getByText("Fray")).toBeInTheDocument()
    expect(screen.queryByText("After")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /episodes ↓|Show less ↑/ }),
    ).not.toBeInTheDocument()
  })

  it("applies source filters and exposes filtered empty recovery", async () => {
    const user = userEvent.setup()

    render(
      <ReleaseCalendarView
        releases={[
          createRelease({
            id: 1,
            title: "Watchlist Movie",
            uniqueKey: "movie-1",
            sourceLists: ["watchlist"],
          }),
          createRelease({
            id: 2,
            title: "Favorite Movie",
            uniqueKey: "movie-2",
            sourceLists: ["favorites"],
          }),
          createRelease({
            id: 3,
            mediaType: "tv",
            title: "Watching Show",
            uniqueKey: "tv-3-s1-e1",
            sourceLists: ["currently-watching"],
            nextEpisode: {
              seasonNumber: 1,
              episodeNumber: 1,
            },
          }),
        ]}
        isPremium
      />,
    )

    expect(
      screen.getByTestId("release-calendar-filter-sort-button"),
    ).toHaveTextContent("Filter / Sort")
    await user.click(screen.getByRole("button", { name: "Filter Favorites" }))

    expect(screen.queryByText("Watchlist Movie")).not.toBeInTheDocument()
    expect(screen.getByText("Favorite Movie")).toBeInTheDocument()
    expect(screen.queryByText("Watching Show")).not.toBeInTheDocument()

    await user.click(screen.getByTestId("release-calendar-media-tab-tv"))

    expect(
      screen.getByText("No releases match these filters"),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Clear Filters" }))

    expect(screen.getByText("Watchlist Movie")).toBeInTheDocument()
    expect(screen.getByText("Favorite Movie")).toBeInTheDocument()
    expect(screen.getByText("Watching Show")).toBeInTheDocument()
  })

  it("applies the shared sort control and switches to type sections", async () => {
    const user = userEvent.setup()

    render(
      <ReleaseCalendarView
        releases={[
          createRelease({
            id: 9,
            mediaType: "tv",
            title: "Show Later",
            releaseDate: "2099-04-12",
            sourceLists: ["currently-watching"],
            nextEpisode: {
              seasonNumber: 1,
              episodeNumber: 3,
            },
          }),
          createRelease({
            id: 1,
            mediaType: "movie",
            title: "Movie First",
            releaseDate: "2099-04-11",
            uniqueKey: "movie-1",
          }),
        ]}
        isPremium
      />,
    )

    await user.click(screen.getByRole("button", { name: "Sort By Type" }))

    expect(screen.getByRole("heading", { name: "Movies" })).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "TV Shows" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId("release-calendar-temporal-tab-today"),
    ).not.toBeInTheDocument()
  })

  it("uses temporal tabs as date filters without scrolling rows", async () => {
    const user = userEvent.setup()
    const originalScrollIntoView = Object.getOwnPropertyDescriptor(
      Element.prototype,
      "scrollIntoView",
    )
    const scrollIntoViewMock = vi.fn()
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: scrollIntoViewMock,
    })

    try {
      render(
        <ReleaseCalendarView
          releases={[
            createRelease({
              id: 1,
              title: "April",
              releaseDate: "2099-04-10",
              uniqueKey: "movie-1",
            }),
            createRelease({
              id: 2,
              title: "May",
              releaseDate: "2099-05-01",
              uniqueKey: "movie-2",
            }),
          ]}
          isPremium
        />,
      )

      expect(
        screen.getByTestId("release-calendar-temporal-tab-all-dates"),
      ).toBeInTheDocument()
      expect(
        screen.getByTestId("release-calendar-temporal-tab-all-dates"),
      ).toHaveAttribute("aria-pressed", "true")
      expect(screen.getByText("April")).toBeInTheDocument()
      expect(screen.getByText("May")).toBeInTheDocument()

      await user.click(
        screen.getByTestId("release-calendar-temporal-tab-month-2099-05"),
      )

      expect(scrollIntoViewMock).not.toHaveBeenCalled()
      expect(
        screen.getByTestId("release-calendar-temporal-tab-month-2099-05"),
      ).toHaveAttribute("aria-pressed", "true")
      expect(screen.queryByText("April")).not.toBeInTheDocument()
      expect(screen.getByText("May")).toBeInTheDocument()

      await user.click(
        screen.getByTestId("release-calendar-temporal-tab-all-dates"),
      )

      expect(screen.getByText("April")).toBeInTheDocument()
      expect(screen.getByText("May")).toBeInTheDocument()
    } finally {
      if (originalScrollIntoView) {
        Object.defineProperty(
          Element.prototype,
          "scrollIntoView",
          originalScrollIntoView,
        )
      } else {
        Reflect.deleteProperty(Element.prototype, "scrollIntoView")
      }
    }
  })

  it("shows a three-item preview and upgrade CTA for free users", async () => {
    const user = userEvent.setup()
    const onUpgradeClick = vi.fn()

    render(
      <ReleaseCalendarView
        releases={[
          createRelease({ id: 1, title: "One", uniqueKey: "movie-1" }),
          createRelease({
            id: 2,
            title: "Two",
            releaseDate: "2099-04-11",
            uniqueKey: "movie-2",
          }),
          createRelease({
            id: 3,
            title: "Three",
            releaseDate: "2099-04-12",
            uniqueKey: "movie-3",
          }),
          createRelease({
            id: 4,
            title: "Four",
            releaseDate: "2099-04-13",
            uniqueKey: "movie-4",
          }),
        ]}
        isPremium={false}
        onUpgradeClick={onUpgradeClick}
      />,
    )

    expect(screen.getByText("One")).toBeInTheDocument()
    expect(screen.getByText("Two")).toBeInTheDocument()
    expect(screen.getByText("Three")).toBeInTheDocument()
    expect(screen.queryByText("Four")).not.toBeInTheDocument()
    expect(
      screen.getByTestId("release-calendar-upgrade-cta"),
    ).toBeInTheDocument()

    await user.click(screen.getByTestId("release-calendar-upgrade-button"))

    expect(onUpgradeClick).toHaveBeenCalledTimes(1)
  })

  it("shows card skeletons instead of the empty state while refreshing unresolved TV data", () => {
    render(<ReleaseCalendarView releases={[]} isRefreshing isPremium />)

    expect(screen.getByText("Updating TV episodes...")).toBeInTheDocument()
    expect(screen.getByTestId("release-calendar-skeleton")).toBeInTheDocument()
    expect(
      screen.getByTestId("release-calendar-skeleton-grid"),
    ).toBeInTheDocument()
    expect(
      screen.getAllByTestId("release-calendar-skeleton-card"),
    ).toHaveLength(8)
    expect(
      screen.queryByText("No upcoming releases found"),
    ).not.toBeInTheDocument()
  })

  it("keeps rendered releases visible while showing the refresh indicator", () => {
    render(
      <ReleaseCalendarView
        releases={[
          createRelease({ id: 1, title: "One", uniqueKey: "movie-1" }),
          createRelease({
            id: 2,
            title: "Two",
            releaseDate: "2099-04-11",
            uniqueKey: "movie-2",
          }),
        ]}
        isRefreshing
        isPremium
      />,
    )

    expect(screen.getByText("Updating TV episodes...")).toBeInTheDocument()
    expect(screen.getByText("One")).toBeInTheDocument()
    expect(screen.getByText("Two")).toBeInTheDocument()
    expect(
      screen.queryByTestId("release-calendar-skeleton"),
    ).not.toBeInTheDocument()
  })

  it("renders the tracked-list empty state when no releases are available", () => {
    render(<ReleaseCalendarView releases={[]} isPremium />)

    expect(screen.getByText("No upcoming releases found")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Add shows or movies to your Watchlist, Favorites, or Watching list to see upcoming releases here.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Go to Watch Lists" }),
    ).toHaveAttribute("href", "/lists/watch-lists")
  })
})

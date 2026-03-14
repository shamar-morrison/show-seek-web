import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"

import { render, screen, waitFor } from "./utils"

import { ReleaseCalendarView } from "@/components/release-calendar-page-client"
import type { ReleaseCalendarRelease } from "@/types/release-calendar"

function createRelease(
  overrides: Partial<ReleaseCalendarRelease>,
): ReleaseCalendarRelease {
  return {
    id: 1,
    mediaType: "movie",
    title: "Release",
    posterPath: null,
    backdropPath: null,
    releaseDate: "2099-04-10",
    sourceLists: ["watchlist"],
    uniqueKey: "movie-1",
    ...overrides,
  }
}

const HEADER_COPY = "Upcoming movies and episodes from the lists you track most."
const originalClientWidth = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "clientWidth",
)
const originalScrollWidth = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollWidth",
)
const originalScrollLeft = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollLeft",
)
const originalElementScrollIntoView = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "scrollIntoView",
)
const originalElementScrollTo = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "scrollTo",
)

const scrollToMock = vi.fn()
const scrollIntoViewMock = vi.fn()
let overflowEnabled = false
let scrollPositions = new WeakMap<Element, number>()

function restoreDescriptor(
  target: object,
  property: string,
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) {
    Object.defineProperty(target, property, descriptor)
    return
  }

  Reflect.deleteProperty(target, property)
}

describe("ReleaseCalendarView", () => {
  beforeEach(() => {
    overflowEnabled = false
    scrollPositions = new WeakMap<Element, number>()
    scrollToMock.mockReset()
    scrollIntoViewMock.mockReset()

    scrollToMock.mockImplementation(function (
      this: Element,
      options?: ScrollToOptions | number,
    ) {
      const left =
        typeof options === "number" ? options : (options?.left ?? 0)

      scrollPositions.set(this, left)
      this.dispatchEvent(new Event("scroll"))
    })

    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return this.getAttribute("data-testid") === "release-calendar-date-strip"
          ? 200
          : 0
      },
    })

    Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
      configurable: true,
      get() {
        if (this.getAttribute("data-testid") !== "release-calendar-date-strip") {
          return 0
        }

        return overflowEnabled ? 600 : 180
      },
    })

    Object.defineProperty(HTMLElement.prototype, "scrollLeft", {
      configurable: true,
      get() {
        return scrollPositions.get(this) ?? 0
      },
      set(value: number) {
        scrollPositions.set(this, Number(value))
      },
    })

    Object.defineProperty(Element.prototype, "scrollTo", {
      configurable: true,
      writable: true,
      value: scrollToMock,
    })

    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: scrollIntoViewMock,
    })
  })

  afterEach(() => {
    restoreDescriptor(HTMLElement.prototype, "clientWidth", originalClientWidth)
    restoreDescriptor(HTMLElement.prototype, "scrollWidth", originalScrollWidth)
    restoreDescriptor(HTMLElement.prototype, "scrollLeft", originalScrollLeft)
    restoreDescriptor(Element.prototype, "scrollTo", originalElementScrollTo)
    restoreDescriptor(
      Element.prototype,
      "scrollIntoView",
      originalElementScrollIntoView,
    )
  })

  it("groups releases into sections and filters by selected date chip", async () => {
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
            nextEpisode: {
              seasonNumber: 1,
              episodeNumber: 1,
              episodeName: "Pilot",
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

    expect(screen.queryByText(HEADER_COPY)).not.toBeInTheDocument()
    expect(screen.getByText("Alpha")).toBeInTheDocument()
    expect(screen.getByText("Beta")).toBeInTheDocument()
    expect(screen.getByText("Gamma")).toBeInTheDocument()
    expect(screen.getByText("Season 1 Episode 1")).toBeInTheDocument()
    expect(screen.getByText("Pilot")).toBeInTheDocument()
    expect(screen.queryByText("S1E1 • Pilot")).not.toBeInTheDocument()
    expect(screen.getAllByTestId("release-calendar-section-grid")).toHaveLength(2)

    await user.click(screen.getByTestId("release-calendar-date-2099-04-12"))

    expect(screen.queryByText("Alpha")).not.toBeInTheDocument()
    expect(screen.getByText("Beta")).toBeInTheDocument()
    expect(screen.getByText("Gamma")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "April 2099" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "May 2099" })).toBeInTheDocument()
  })

  it("renders date strip arrows when the strip overflows and scrolls without changing selection", async () => {
    const user = userEvent.setup()
    overflowEnabled = true

    render(
      <ReleaseCalendarView
        releases={[
          createRelease({
            id: 1,
            title: "One",
            releaseDate: "2099-04-10",
            uniqueKey: "movie-1",
          }),
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
        isPremium
      />,
    )

    await waitFor(() => {
      expect(
        screen.getByTestId("release-calendar-scroll-left"),
      ).toBeInTheDocument()
      expect(
        screen.getByTestId("release-calendar-scroll-right"),
      ).toBeInTheDocument()
    })

    expect(
      screen.getByTestId("release-calendar-scroll-left"),
    ).toBeDisabled()
    expect(
      screen.getByTestId("release-calendar-scroll-right"),
    ).toBeEnabled()

    await user.click(screen.getByTestId("release-calendar-scroll-right"))

    expect(scrollToMock).toHaveBeenCalledWith({
      left: 160,
      behavior: "smooth",
    })
    expect(
      screen.getByTestId("release-calendar-date-2099-04-10"),
    ).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByText("One")).toBeInTheDocument()
    expect(screen.getByText("Four")).toBeInTheDocument()
  })

  it("moves focus between date chips with keyboard arrows without changing the active filter", async () => {
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
            title: "Beta",
            releaseDate: "2099-04-11",
            uniqueKey: "movie-2",
          }),
          createRelease({
            id: 3,
            title: "Gamma",
            releaseDate: "2099-04-12",
            uniqueKey: "movie-3",
          }),
        ]}
        isPremium
      />,
    )

    const firstChip = screen.getByTestId("release-calendar-date-2099-04-10")
    const secondChip = screen.getByTestId("release-calendar-date-2099-04-11")
    const thirdChip = screen.getByTestId("release-calendar-date-2099-04-12")

    firstChip.focus()
    expect(firstChip).toHaveFocus()

    await user.keyboard("{ArrowRight}")
    expect(secondChip).toHaveFocus()

    await user.keyboard("{ArrowRight}")
    expect(thirdChip).toHaveFocus()

    await user.keyboard("{ArrowLeft}")
    expect(secondChip).toHaveFocus()

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(3)
    expect(scrollIntoViewMock).toHaveBeenLastCalledWith({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    })
    expect(firstChip).toHaveAttribute("aria-pressed", "false")
    expect(secondChip).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByText("Alpha")).toBeInTheDocument()
    expect(screen.getByText("Gamma")).toBeInTheDocument()
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

  it("shows card skeletons instead of the empty state while refreshing unresolved data", () => {
    render(
      <ReleaseCalendarView
        releases={[]}
        isRefreshing
        isPremium
      />,
    )

    expect(screen.getByText("Updating releases...")).toBeInTheDocument()
    expect(screen.getByTestId("release-calendar-skeleton")).toBeInTheDocument()
    expect(screen.getByTestId("release-calendar-skeleton-grid")).toBeInTheDocument()
    expect(screen.getAllByTestId("release-calendar-skeleton-card")).toHaveLength(8)
    expect(screen.queryByText("No upcoming releases found")).not.toBeInTheDocument()
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

    expect(screen.getByText("Refreshing releases...")).toBeInTheDocument()
    expect(screen.getByText("One")).toBeInTheDocument()
    expect(screen.getByText("Two")).toBeInTheDocument()
    expect(screen.queryByTestId("release-calendar-skeleton")).not.toBeInTheDocument()
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

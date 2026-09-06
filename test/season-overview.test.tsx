import { SeasonOverview } from "@/components/season-overview"
import { render, screen } from "@/test/utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"

const originalScrollHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollHeight",
)
const originalClientHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "clientHeight",
)
const originalResizeObserver = window.ResizeObserver

let measurementHasOverflow = false

describe("SeasonOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    measurementHasOverflow = false

    class MockResizeObserver implements ResizeObserver {
      disconnect = vi.fn()
      observe = vi.fn()
      unobserve = vi.fn()

      constructor(callback: ResizeObserverCallback) {
        void callback
      }
    }

    window.ResizeObserver = MockResizeObserver

    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        const element = this as HTMLElement

        if (element.dataset.testid === "season-overview-measurement") {
          return measurementHasOverflow ? 320 : 72
        }

        return 0
      },
    })

    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        const element = this as HTMLElement

        if (element.dataset.testid === "season-overview-measurement") {
          return 72
        }

        return 0
      },
    })
  })

  afterEach(() => {
    window.ResizeObserver = originalResizeObserver

    if (originalScrollHeight) {
      Object.defineProperty(
        HTMLElement.prototype,
        "scrollHeight",
        originalScrollHeight,
      )
    }

    if (originalClientHeight) {
      Object.defineProperty(
        HTMLElement.prototype,
        "clientHeight",
        originalClientHeight,
      )
    }
  })

  it("does not render a button for short overviews", () => {
    render(
      <SeasonOverview overview="A short season." blurPlotSpoilers={false} />,
    )

    expect(screen.getByTestId("season-overview-text")).toHaveTextContent(
      "A short season.",
    )
    expect(
      screen.queryByRole("button", { name: "Read more" }),
    ).not.toBeInTheDocument()
  })

  it("toggles long overviews inline", async () => {
    const user = userEvent.setup()
    measurementHasOverflow = true

    render(
      <SeasonOverview
        overview={new Array(20)
          .fill("This season overview has enough detail to span many lines.")
          .join(" ")}
        blurPlotSpoilers={false}
      />,
    )

    const button = await screen.findByRole("button", { name: "Read more" })
    const text = screen.getByTestId("season-overview-text")

    expect(text).toHaveClass("line-clamp-3")

    await user.click(button)

    expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument()
    expect(text).not.toHaveClass("line-clamp-3")

    await user.click(screen.getByRole("button", { name: "Show less" }))

    expect(screen.getByRole("button", { name: "Read more" })).toBeInTheDocument()
    expect(text).toHaveClass("line-clamp-3")
  })

  it("applies spoiler blur to the overview text", () => {
    render(
      <SeasonOverview overview="A short season." blurPlotSpoilers={true} />,
    )

    expect(screen.getByTestId("season-overview-text")).toHaveClass("blur-md")
  })
})

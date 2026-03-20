import { PersonBiography } from "@/components/person-biography"
import { render, screen } from "@/test/utils"
import { act } from "@testing-library/react"
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
let resizeObserverCallback: ResizeObserverCallback | null = null

function triggerResizeObserver() {
  act(() => {
    resizeObserverCallback?.([], {} as ResizeObserver)
  })
}

describe("PersonBiography", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    measurementHasOverflow = false
    resizeObserverCallback = null

    class MockResizeObserver implements ResizeObserver {
      disconnect = vi.fn()
      observe = vi.fn()
      unobserve = vi.fn()

      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallback = callback
      }
    }

    window.ResizeObserver = MockResizeObserver

    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        const element = this as HTMLElement

        if (element.dataset.testid === "person-biography-measurement") {
          return measurementHasOverflow ? 320 : 72
        }

        return 0
      },
    })

    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        const element = this as HTMLElement

        if (element.dataset.testid === "person-biography-measurement") {
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

  it("does not render a button for short biographies", async () => {
    render(<PersonBiography biography="" personName="Sample Person" />)

    expect(screen.getByTestId("person-biography-text")).toHaveTextContent(
      "We don't have a biography for Sample Person.",
    )
    expect(
      screen.queryByRole("button", { name: "Read more" }),
    ).not.toBeInTheDocument()
  })

  it("toggles long biographies inline", async () => {
    const user = userEvent.setup()
    measurementHasOverflow = true

    render(
      <PersonBiography
        biography={new Array(20)
          .fill("This biography has enough detail to span many lines.")
          .join(" ")}
        personName="Sample Person"
      />,
    )

    const button = await screen.findByRole("button", { name: "Read more" })
    const text = screen.getByTestId("person-biography-text")

    expect(text).toHaveClass("line-clamp-4")

    await user.click(button)

    expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument()
    expect(text).not.toHaveClass("line-clamp-4")

    await user.click(screen.getByRole("button", { name: "Show less" }))

    expect(screen.getByRole("button", { name: "Read more" })).toBeInTheDocument()
    expect(text).toHaveClass("line-clamp-4")
  })

  it("stays expanded after resize re-measure until overflow disappears", async () => {
    const user = userEvent.setup()
    measurementHasOverflow = true

    render(
      <PersonBiography
        biography={new Array(20)
          .fill("This biography has enough detail to span many lines.")
          .join(" ")}
        personName="Sample Person"
      />,
    )

    await user.click(await screen.findByRole("button", { name: "Read more" }))

    const text = screen.getByTestId("person-biography-text")

    expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument()
    expect(text).not.toHaveClass("line-clamp-4")

    triggerResizeObserver()

    expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument()
    expect(text).not.toHaveClass("line-clamp-4")

    measurementHasOverflow = false
    triggerResizeObserver()

    expect(
      screen.queryByRole("button", { name: "Show less" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Read more" }),
    ).not.toBeInTheDocument()
    expect(text).toHaveClass("line-clamp-4")
  })
})

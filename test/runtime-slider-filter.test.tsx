import { act, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { RuntimeSliderFilter } from "@/components/discover/runtime-slider-filter"

vi.mock("@/components/ui/slider", () => ({
  Slider: ({
    disabled,
    formatValue,
    max,
    min,
    onValueChange,
    step,
    value,
  }: {
    disabled?: boolean
    formatValue?: (value: number) => string
    max?: number
    min?: number
    onValueChange?: (value: [number, number]) => void
    step?: number
    value: [number, number]
  }) => {
    const [lo, hi] = value

    return (
      <div>
        <span>
          {formatValue?.(lo)}-{formatValue?.(hi)}
        </span>
        <input
          aria-label="Runtime min"
          disabled={disabled}
          max={max}
          min={min}
          onChange={(event) =>
            onValueChange?.([Number(event.target.value), hi])
          }
          step={step}
          type="number"
          value={lo}
        />
        <input
          aria-label="Runtime max"
          disabled={disabled}
          max={max}
          min={min}
          onChange={(event) =>
            onValueChange?.([lo, Number(event.target.value)])
          }
          step={step}
          type="number"
          value={hi}
        />
      </div>
    )
  },
}))

// Passthrough popover: content always rendered, plus a test-only close
// control driving onOpenChange(false) like a real popup dismissal.
vi.mock("@/components/ui/popover", () => ({
  Popover: ({
    children,
    onOpenChange,
  }: {
    children?: ReactNode
    onOpenChange?: (open: boolean) => void
  }) => (
    <div>
      {children}
      <button
        type="button"
        aria-label="Close runtime popover"
        onClick={() => onOpenChange?.(false)}
      >
        Close
      </button>
    </div>
  ),
  PopoverTrigger: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  PopoverContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}))

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <svg />,
}))

describe("RuntimeSliderFilter", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function advanceCommitDelay() {
    act(() => {
      vi.advanceTimersByTime(500)
    })
  }

  it("shows a placeholder trigger when off and the range when set", () => {
    const onCommit = vi.fn()

    const { rerender } = render(
      <RuntimeSliderFilter value={null} onCommit={onCommit} />,
    )
    expect(screen.getByText("All Lengths")).toBeInTheDocument()

    rerender(<RuntimeSliderFilter value={[90, 150]} onCommit={onCommit} />)
    expect(screen.getByText("1h 30m – 2h 30m")).toBeInTheDocument()
  })

  it("does not commit on mount", () => {
    const onCommit = vi.fn()

    render(<RuntimeSliderFilter value={null} onCommit={onCommit} />)
    advanceCommitDelay()

    expect(onCommit).not.toHaveBeenCalled()
  })

  it("commits a narrowed range only after the debounce settles", () => {
    const onCommit = vi.fn()

    render(<RuntimeSliderFilter value={null} onCommit={onCommit} />)

    fireEvent.change(screen.getByLabelText("Runtime min"), {
      target: { value: "90" },
    })

    // Thumb moved instantly, but nothing commits mid-drag.
    expect(screen.getByLabelText("Runtime min")).toHaveValue(90)
    expect(onCommit).not.toHaveBeenCalled()

    advanceCommitDelay()

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith([90, 240])
  })

  it("coalesces rapid drags into a single commit with the latest range", () => {
    const onCommit = vi.fn()

    render(<RuntimeSliderFilter value={null} onCommit={onCommit} />)

    fireEvent.change(screen.getByLabelText("Runtime min"), {
      target: { value: "90" },
    })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    fireEvent.change(screen.getByLabelText("Runtime max"), {
      target: { value: "150" },
    })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    fireEvent.change(screen.getByLabelText("Runtime min"), {
      target: { value: "100" },
    })
    advanceCommitDelay()

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith([100, 150])
  })

  it("commits null when dragged back to the full span", () => {
    const onCommit = vi.fn()

    render(<RuntimeSliderFilter value={[90, 150]} onCommit={onCommit} />)

    fireEvent.change(screen.getByLabelText("Runtime min"), {
      target: { value: "60" },
    })
    fireEvent.change(screen.getByLabelText("Runtime max"), {
      target: { value: "240" },
    })
    advanceCommitDelay()

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith(null)
  })

  it("flushes a pending drag when the popover closes", () => {
    const onCommit = vi.fn()

    render(<RuntimeSliderFilter value={null} onCommit={onCommit} />)

    fireEvent.change(screen.getByLabelText("Runtime min"), {
      target: { value: "90" },
    })
    expect(onCommit).not.toHaveBeenCalled()

    // Closing before the debounce settles still applies the drag.
    fireEvent.click(
      screen.getByRole("button", { name: "Close runtime popover" }),
    )

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith([90, 240])

    // The cancelled timer must not produce a duplicate commit.
    advanceCommitDelay()
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it("resets immediately via the footer reset", () => {
    const onCommit = vi.fn()

    render(<RuntimeSliderFilter value={[90, 150]} onCommit={onCommit} />)

    fireEvent.click(screen.getByRole("button", { name: "Reset" }))

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith(null)

    // The pending debounce resolves to the same cleared state: no duplicate.
    advanceCommitDelay()
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it("syncs when the committed value changes externally", () => {
    const onCommit = vi.fn()

    const { rerender } = render(
      <RuntimeSliderFilter value={null} onCommit={onCommit} />,
    )
    expect(screen.getByLabelText("Runtime min")).toHaveValue(60)

    rerender(<RuntimeSliderFilter value={[90, 150]} onCommit={onCommit} />)

    expect(screen.getByLabelText("Runtime min")).toHaveValue(90)
    expect(screen.getByLabelText("Runtime max")).toHaveValue(150)
    expect(onCommit).not.toHaveBeenCalled()
  })
})

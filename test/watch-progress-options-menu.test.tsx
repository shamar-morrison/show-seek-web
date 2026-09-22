import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

import { WatchProgressOptionsMenu } from "@/components/watch-progress-options-menu"
import { fireEvent, render, screen } from "./utils"

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "View options" }))
}

describe("WatchProgressOptionsMenu", () => {
  it("renders a trigger button that opens the options menu", () => {
    render(
      <WatchProgressOptionsMenu
        hideCompleted={false}
        onHideCompletedChange={() => undefined}
      />,
    )

    expect(
      screen.getByTestId("watch-progress-options-button"),
    ).toBeInTheDocument()

    openMenu()

    expect(
      screen.getByTestId("watch-progress-hide-completed-row"),
    ).toBeInTheDocument()
    expect(screen.getByText("Hide completed series")).toBeInTheDocument()
  })

  it("reflects the checked state in the switch", () => {
    render(
      <WatchProgressOptionsMenu
        hideCompleted={true}
        onHideCompletedChange={() => undefined}
      />,
    )

    openMenu()

    expect(screen.getByRole("switch")).toBeChecked()
  })

  it("calls onHideCompletedChange when the switch is toggled", () => {
    const onHideCompletedChange = vi.fn()
    render(
      <WatchProgressOptionsMenu
        hideCompleted={false}
        onHideCompletedChange={onHideCompletedChange}
      />,
    )

    openMenu()
    fireEvent.click(screen.getByRole("switch"))

    expect(onHideCompletedChange).toHaveBeenCalledWith(true)
  })

  it("toggles when the row is clicked", () => {
    const onHideCompletedChange = vi.fn()
    render(
      <WatchProgressOptionsMenu
        hideCompleted={true}
        onHideCompletedChange={onHideCompletedChange}
      />,
    )

    openMenu()
    fireEvent.click(
      screen.getByTestId("watch-progress-hide-completed-row"),
    )

    expect(onHideCompletedChange).toHaveBeenCalledWith(false)
  })

  it("shows an active badge on the trigger when hideCompleted is on", () => {
    const { rerender } = render(
      <WatchProgressOptionsMenu
        hideCompleted={false}
        onHideCompletedChange={() => undefined}
      />,
    )
    expect(
      screen.queryByTestId("watch-progress-options-badge"),
    ).not.toBeInTheDocument()

    rerender(
      <WatchProgressOptionsMenu
        hideCompleted={true}
        onHideCompletedChange={() => undefined}
      />,
    )
    expect(
      screen.getByTestId("watch-progress-options-badge"),
    ).toBeInTheDocument()
  })

  it("updates state through a controlled harness", () => {
    function Harness() {
      const [hideCompleted, setHideCompleted] = useState(false)
      return (
        <WatchProgressOptionsMenu
          hideCompleted={hideCompleted}
          onHideCompletedChange={setHideCompleted}
        />
      )
    }
    render(<Harness />)

    openMenu()
    expect(screen.getByRole("switch")).not.toBeChecked()
    fireEvent.click(screen.getByRole("switch"))
    expect(screen.getByRole("switch")).toBeChecked()
  })
})

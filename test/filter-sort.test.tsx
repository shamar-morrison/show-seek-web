import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

import { FilterSort } from "@/components/ui/filter-sort"
import userEvent from "@testing-library/user-event"
import { fireEvent, render, screen } from "./utils"

function SourcesHarness({
  maxSelected,
  onMaxSelectedAttempt,
}: {
  maxSelected?: number
  onMaxSelectedAttempt?: () => void
}) {
  const [values, setValues] = useState<string[]>([])

  return (
    <FilterSort
      filters={[
        {
          key: "source",
          label: "Sources",
          selectionMode: "multiple",
          maxSelected,
          onMaxSelectedAttempt,
          options: [
            { value: "a", label: "Option A" },
            { value: "b", label: "Option B" },
            { value: "c", label: "Option C" },
          ],
        },
      ]}
      filterState={{}}
      onFilterChange={() => undefined}
      multiFilterState={{ source: values }}
      onMultiFilterChange={(key, next) => {
        if (key === "source") {
          setValues(next)
        }
      }}
      sortFields={[]}
      sortState={{ field: "soonest", direction: "asc" }}
      onSortChange={() => undefined}
      triggerLabel="Filter / Sort"
    />
  )
}

function openSourcesSubmenu() {
  fireEvent.click(screen.getByRole("button", { name: "Filter / Sort" }))
  fireEvent.click(screen.getByRole("menuitem", { name: /Sources/ }))
}

function getOption(name: string) {
  return screen.getByRole("menuitemcheckbox", { name })
}

describe("FilterSort trigger tooltip", () => {
  function renderIconOnlyTrigger() {
    return render(
      <FilterSort
        filters={[
          {
            key: "mediaType",
            label: "Media Type",
            options: [{ value: "all", label: "All" }],
          },
        ]}
        filterState={{ mediaType: "all" }}
        onFilterChange={() => undefined}
        sortFields={[]}
        sortState={{ field: "added", direction: "desc" }}
        onSortChange={() => undefined}
        triggerTooltip="Filter and sort"
      />,
    )
  }

  it("shows the tooltip on hover with a matching aria-label", async () => {
    const user = userEvent.setup()

    renderIconOnlyTrigger()

    const trigger = screen.getByRole("button", { name: "Filter and sort" })
    expect(trigger).toHaveAttribute("aria-label", "Filter and sort")

    await user.hover(trigger)
    expect(await screen.findByText("Filter and sort")).toBeInTheDocument()
  })

  it("does not show the tooltip while the menu is open", async () => {
    const user = userEvent.setup()

    renderIconOnlyTrigger()

    const trigger = screen.getByRole("button", { name: "Filter and sort" })
    // Positive control: the tooltip mechanism works while closed.
    await user.hover(trigger)
    expect(await screen.findByText("Filter and sort")).toBeInTheDocument()

    await user.click(trigger)
    // The menu is open; the tooltip must stay suppressed on re-hover.
    expect(await screen.findByText("Filters")).toBeInTheDocument()
    await user.hover(trigger)
    expect(screen.queryByText("Filter and sort")).not.toBeInTheDocument()
  })
})

describe("FilterSort maxSelected", () => {
  it("disables unchecked options once the cap is reached", () => {
    const onMaxSelectedAttempt = vi.fn()
    render(<SourcesHarness maxSelected={2} onMaxSelectedAttempt={onMaxSelectedAttempt} />)

    openSourcesSubmenu()
    fireEvent.click(getOption("Option A"))
    fireEvent.click(getOption("Option B"))

    expect(getOption("Option A")).toHaveAttribute("aria-checked", "true")
    expect(getOption("Option B")).toHaveAttribute("aria-checked", "true")
    expect(getOption("Option C")).toHaveAttribute("aria-disabled", "true")

    // An over-cap attempt surfaces feedback and holds the cap.
    fireEvent.click(getOption("Option C"))
    expect(onMaxSelectedAttempt).toHaveBeenCalledTimes(1)
    expect(getOption("Option A")).toHaveAttribute("aria-checked", "true")
    expect(getOption("Option B")).toHaveAttribute("aria-checked", "true")
  })

  it("re-enables options after unchecking below the cap", () => {
    render(<SourcesHarness maxSelected={2} />)

    openSourcesSubmenu()
    fireEvent.click(getOption("Option A"))
    fireEvent.click(getOption("Option B"))
    fireEvent.click(getOption("Option A"))

    expect(getOption("Option C")).not.toHaveAttribute("aria-disabled", "true")
  })

  it("allows unlimited selection without maxSelected", () => {
    render(<SourcesHarness />)

    openSourcesSubmenu()
    fireEvent.click(getOption("Option A"))
    fireEvent.click(getOption("Option B"))
    fireEvent.click(getOption("Option C"))

    expect(getOption("Option C")).toHaveAttribute("aria-checked", "true")
  })
})

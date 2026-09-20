import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

import { FilterSort } from "@/components/ui/filter-sort"
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

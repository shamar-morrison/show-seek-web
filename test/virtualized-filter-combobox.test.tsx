import { VirtualizedFilterCombobox } from "@/components/ui/virtualized-filter-combobox"
import { render, screen, waitFor } from "@/test/utils"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

function makeOptions(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    label: `Option ${index + 1}`,
    value: `option-${index + 1}`,
  }))
}

async function openCombobox(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /select/i }))
  return await screen.findByTestId("filter-combobox-list")
}

describe("VirtualizedFilterCombobox", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("sizes short lists to their content without scrolling", async () => {
    const user = userEvent.setup()

    render(
      <VirtualizedFilterCombobox
        label="Language"
        options={makeOptions(2)}
        debounceDelay={0}
      />,
    )

    const list = await openCombobox(user)

    expect(list.style.height).toBe("")
    expect(list.className).toContain("overflow-y-hidden")
    expect(list.className).not.toContain("overflow-y-auto")
  })

  it("caps long lists at a fixed height with scrolling", async () => {
    const user = userEvent.setup()

    render(
      <VirtualizedFilterCombobox
        label="Language"
        options={makeOptions(10)}
        debounceDelay={0}
      />,
    )

    const list = await openCombobox(user)

    expect(list.style.height).toBe("320px")
    expect(list.className).toContain("overflow-y-auto")
  })

  it("stops scrolling once search filters the list down", async () => {
    const user = userEvent.setup()

    render(
      <VirtualizedFilterCombobox
        label="Language"
        options={makeOptions(10)}
        debounceDelay={0}
      />,
    )

    await openCombobox(user)

    expect(screen.getByTestId("filter-combobox-list").className).toContain(
      "overflow-y-auto",
    )

    await user.type(
      screen.getByPlaceholderText("Search..."),
      "Option 1",
    )

    await waitFor(() => {
      const list = screen.getByTestId("filter-combobox-list")
      expect(list.className).not.toContain("overflow-y-auto")
      expect(list.className).toContain("overflow-y-hidden")
    })
  })
})

import { SearchInput } from "@/components/ui/search-input"
import { fireEvent, render, screen } from "@/test/utils"
import { describe, expect, it, vi } from "vitest"

describe("SearchInput", () => {
  it("renders search input with placeholder and value", () => {
    render(
      <SearchInput
        value="Inception"
        onChange={vi.fn()}
        placeholder="Search movies..."
      />,
    )

    const input = screen.getByPlaceholderText("Search movies...")
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue("Inception")
  })

  it("does not render the clear button when value is empty", () => {
    render(
      <SearchInput
        value=""
        onChange={vi.fn()}
        placeholder="Search..."
      />,
    )

    expect(
      screen.queryByRole("button", { name: "Clear search" }),
    ).not.toBeInTheDocument()
  })

  it("renders the clear button when value is present", () => {
    render(
      <SearchInput
        value="Breaking Bad"
        onChange={vi.fn()}
        placeholder="Search..."
      />,
    )

    expect(
      screen.getByRole("button", { name: "Clear search" }),
    ).toBeInTheDocument()
  })

  it("calls onChange with empty string and refocuses input when clear button is clicked", () => {
    const handleChange = vi.fn()
    const handleClear = vi.fn()

    render(
      <SearchInput
        value="Succession"
        onChange={handleChange}
        onClear={handleClear}
        placeholder="Search..."
      />,
    )

    const input = screen.getByPlaceholderText("Search...")
    const clearButton = screen.getByRole("button", { name: "Clear search" })

    fireEvent.click(clearButton)

    expect(handleChange).toHaveBeenCalledWith("")
    expect(handleClear).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(input)
  })
})

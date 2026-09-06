import { AccentColorModal } from "@/components/profile/accent-color-modal"
import { ACCENT_COLORS } from "@/lib/accent-colors"
import { render, screen, within } from "@/test/utils"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

function renderModal(
  overrides?: Partial<Parameters<typeof AccentColorModal>[0]>,
) {
  const onOpenChange = vi.fn()
  const onSelectColor = vi.fn().mockResolvedValue(undefined)
  render(
    <AccentColorModal
      open
      onOpenChange={onOpenChange}
      accentColor="#E50914"
      onSelectColor={onSelectColor}
      {...overrides}
    />,
  )
  return { onOpenChange, onSelectColor }
}

describe("AccentColorModal", () => {
  it("lists every supported color with the current one marked selected", () => {
    renderModal()

    for (const color of ACCENT_COLORS) {
      expect(
        screen.getByRole("button", { name: new RegExp(color.name) }),
      ).toBeInTheDocument()
    }
    expect(
      screen.getByRole("button", { name: /red/i }),
    ).toHaveAttribute("aria-pressed", "true")
  })

  it("saves the new color and closes on select", async () => {
    const user = userEvent.setup()
    const { onOpenChange, onSelectColor } = renderModal()

    await user.click(screen.getByRole("button", { name: /blue/i }))

    expect(onSelectColor).toHaveBeenCalledWith("#3B82F6")
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("ignores clicks on the already-selected color", async () => {
    const user = userEvent.setup()
    const { onSelectColor } = renderModal()

    await user.click(screen.getByRole("button", { name: /red/i }))

    expect(onSelectColor).not.toHaveBeenCalled()
  })

  it("stays open when saving fails so the parent error toast can show", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const onSelectColor = vi.fn().mockRejectedValue(new Error("nope"))
    render(
      <AccentColorModal
        open
        onOpenChange={onOpenChange}
        accentColor="#E50914"
        onSelectColor={onSelectColor}
      />,
    )

    const blueButton = screen.getByRole("button", { name: /blue/i })
    await user.click(blueButton)

    expect(onSelectColor).toHaveBeenCalledWith("#3B82F6")
    expect(onOpenChange).not.toHaveBeenCalled()
    // The failed row is clickable again after the error.
    expect(blueButton).not.toBeDisabled()
    expect(
      within(blueButton).queryByText("Saving color"),
    ).not.toBeInTheDocument()
  })
})

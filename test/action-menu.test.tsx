import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu"
import { render, screen } from "./utils"

const ITEMS: ActionMenuItem[] = [
  {
    type: "action",
    key: "edit",
    label: "Edit List Details",
    onClick: () => undefined,
  },
]

describe("ActionMenu trigger tooltip", () => {
  it("shows the tooltip on hover with a matching aria-label", async () => {
    const user = userEvent.setup()

    render(
      <ActionMenu
        items={ITEMS}
        triggerTooltip="List options"
        triggerAriaLabel="List options"
      />,
    )

    const trigger = screen.getByRole("button", { name: "List options" })
    expect(trigger).toHaveAttribute("aria-label", "List options")

    await user.hover(trigger)
    expect(await screen.findByText("List options")).toBeInTheDocument()
  })

  it("keeps More options as the default label without tooltip props", () => {
    render(<ActionMenu items={ITEMS} />)

    expect(
      screen.getByRole("button", { name: "More options" }),
    ).toBeInTheDocument()
  })

  it("does not show the tooltip while the menu is open", async () => {
    const user = userEvent.setup()

    render(
      <ActionMenu
        items={ITEMS}
        triggerTooltip="List options"
        triggerAriaLabel="List options"
      />,
    )

    const trigger = screen.getByRole("button", { name: "List options" })
    // Positive control: the tooltip mechanism works while closed.
    await user.hover(trigger)
    expect(await screen.findByText("List options")).toBeInTheDocument()

    await user.click(trigger)
    // The menu is open; the tooltip must stay suppressed on re-hover.
    expect(
      await screen.findByRole("menuitem", { name: "Edit List Details" }),
    ).toBeInTheDocument()
    expect(screen.queryByText("List options")).not.toBeInTheDocument()
    await user.hover(trigger)
    expect(screen.queryByText("List options")).not.toBeInTheDocument()
  })
})

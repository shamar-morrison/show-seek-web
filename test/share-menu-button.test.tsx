import { ShareMenuButton } from "@/components/share-menu-button"
import { render, screen, waitFor } from "@/test/utils"
import type { SharePostMedia } from "@/lib/share-post"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  modalProps: null as null | {
    isOpen: boolean
    media: SharePostMedia
    caption: string
  },
}))

vi.mock("@/components/share-post-modal", () => ({
  SharePostModal: (props: {
    isOpen: boolean
    onClose: () => void
    media: SharePostMedia
    caption: string
  }) => {
    mocks.modalProps = props
    return props.isOpen ? <div data-testid="share-post-modal" /> : null
  },
}))

function createMedia(): SharePostMedia {
  return {
    id: 123,
    mediaType: "movie",
    title: "Inception",
    posterUrl: "https://image.tmdb.org/t/p/original/poster.jpg",
    backdropUrl: null,
    releaseYear: "2010",
    genres: ["Sci-Fi"],
    userRating: 9,
  }
}

describe("ShareMenuButton", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.modalProps = null
  })

  it("renders an icon-only trigger for the extensible menu", () => {
    render(<ShareMenuButton media={createMedia()} />)

    const trigger = screen.getByTestId("share-menu-button")
    expect(trigger).toHaveAttribute("aria-label", "More options")
    expect(trigger).not.toHaveTextContent("Share")
  })

  it("opens the share post modal from the menu item", async () => {
    const user = userEvent.setup()

    render(<ShareMenuButton media={createMedia()} />)

    await user.click(screen.getByTestId("share-menu-button"))

    const menuItem = await screen.findByRole("menuitem", {
      name: /create share post/i,
    })
    await user.click(menuItem)

    await waitFor(() => {
      expect(screen.getByTestId("share-post-modal")).toBeInTheDocument()
    })
    expect(mocks.modalProps?.caption).toBe(
      "Check out Inception (2010) on ShowSeek! My rating: 9/10.",
    )
    expect(mocks.modalProps?.media.title).toBe("Inception")
  })

  it("renders extra items for future actions", async () => {
    const user = userEvent.setup()
    const onFutureAction = vi.fn()

    render(
      <ShareMenuButton
        media={createMedia()}
        extraItems={[
          {
            type: "action",
            key: "future-action",
            label: "Future Action",
            onClick: onFutureAction,
          },
        ]}
      />,
    )

    await user.click(screen.getByTestId("share-menu-button"))

    const futureItem = await screen.findByRole("menuitem", {
      name: /future action/i,
    })
    await user.click(futureItem)

    expect(onFutureAction).toHaveBeenCalledTimes(1)
  })
})

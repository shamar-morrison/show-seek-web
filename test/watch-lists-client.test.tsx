import { WatchListsClient } from "@/app/lists/watch-lists/watch-lists-client"
import { render, screen, waitFor } from "@/test/utils"
import type { UserList } from "@/types/list"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  lists: [] as UserList[],
}))

function setLocation(search = "", pathname = "/lists/watch-lists") {
  window.history.pushState({}, "", `${pathname}${search}`)
}

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

vi.mock("@/hooks/use-lists", () => ({
  useLists: () => ({
    error: null,
    lists: mocks.lists,
    loading: false,
  }),
}))

vi.mock("@/components/lists-page-client", () => ({
  ListsPageClient: ({
    lists,
    onListSelect,
    selectedListId,
    showDefaultSelectAction = true,
    showAllTab = false,
  }: {
    lists: UserList[]
    onListSelect?: (listId: string) => void
    selectedListId?: string
    showDefaultSelectAction?: boolean
    showAllTab?: boolean
    children?: ReactNode
  }) => {
    const activeList =
      lists.find((list) => list.id === selectedListId) ?? lists[0]
    const canSelectItems = Object.keys(activeList?.items || {}).length > 0

    return (
      <div>
        <div data-testid="active-list-id">{activeList?.id ?? ""}</div>
        <div data-testid="selected-list-id">{selectedListId ?? ""}</div>
        {showAllTab ? <div data-testid="show-all-tab" /> : null}
        {lists.map((list) => (
          <button
            key={list.id}
            type="button"
            onClick={() => onListSelect?.(list.id)}
          >
            Open {list.name}
          </button>
        ))}
        {showDefaultSelectAction && canSelectItems ? (
          <button type="button">Select</button>
        ) : null}
      </div>
    )
  },
}))

describe("WatchListsClient", () => {
  beforeEach(() => {
    setLocation()
    mocks.lists = [
      {
        id: "watchlist",
        name: "Should Watch",
        createdAt: 0,
        isCustom: false,
        items: {
          "123": {
            id: 123,
            title: "Spirited Away",
            poster_path: null,
            media_type: "movie",
            addedAt: 111,
          },
        },
      },
    ]
  })

  it("keeps the standalone select button enabled for watch lists", () => {
    render(<WatchListsClient movieGenres={[]} tvGenres={[]} />)

    expect(screen.getByRole("button", { name: "Select" })).toBeInTheDocument()
  })

  it("switches watch list tabs and clears the URL when returning to the default list", async () => {
    const user = userEvent.setup()

    mocks.lists = [
      ...mocks.lists,
      {
        id: "currently-watching",
        name: "Currently Watching",
        createdAt: 1,
        isCustom: false,
        items: {
          "456": {
            id: 456,
            title: "Your Name",
            poster_path: null,
            media_type: "movie",
            addedAt: 222,
          },
        },
      },
    ]
    setLocation("?listId=currently-watching")

    render(<WatchListsClient movieGenres={[]} tvGenres={[]} />)

    await screen.findByTestId("active-list-id")
    expect(screen.getByTestId("active-list-id")).toHaveTextContent(
      "currently-watching",
    )
    expect(window.location.search).toBe("?listId=currently-watching")

    await user.click(screen.getByRole("button", { name: "Open Should Watch" }))

    await screen.findByRole("button", { name: "Select" })
    expect(screen.getByTestId("active-list-id")).toHaveTextContent("watchlist")

    await waitFor(() => {
      expect(window.location.search).toBe("")
    })
  })

  it("selects the virtual All tab from ?listId=all and keeps the param", async () => {
    setLocation("?listId=all")

    render(<WatchListsClient movieGenres={[]} tvGenres={[]} />)

    expect(screen.getByTestId("selected-list-id")).toHaveTextContent("all")
    expect(screen.getByTestId("show-all-tab")).toBeInTheDocument()
    expect(window.location.search).toBe("?listId=all")
  })

  it("omits listId from the URL on the default landing tab", () => {
    render(<WatchListsClient movieGenres={[]} tvGenres={[]} />)

    expect(screen.getByTestId("selected-list-id")).toHaveTextContent(
      "watchlist",
    )
    expect(window.location.search).toBe("")
  })
})

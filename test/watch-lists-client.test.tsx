import { WatchListsClient } from "@/app/lists/watch-lists/watch-lists-client"
import { render, screen } from "@/test/utils"
import type { UserList } from "@/types/list"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  lists: [] as UserList[],
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
    selectedListId,
    showDefaultSelectAction = true,
  }: {
    lists: UserList[]
    selectedListId?: string
    showDefaultSelectAction?: boolean
    children?: ReactNode
  }) => {
    const activeList =
      lists.find((list) => list.id === selectedListId) ?? lists[0]
    const canSelectItems = Object.keys(activeList?.items || {}).length > 0

    return showDefaultSelectAction && canSelectItems ? (
      <button type="button">Select</button>
    ) : null
  },
}))

describe("WatchListsClient", () => {
  beforeEach(() => {
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
})

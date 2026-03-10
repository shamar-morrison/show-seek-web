import { CollectionProgressClient } from "@/app/lists/collection-progress/collection-progress-client"
import { render, screen } from "@/test/utils"
import { beforeEach, describe, expect, it, vi } from "vitest"

const useCollectionProgressListMock = vi.fn()

vi.mock("@/hooks/use-collection-tracking", () => ({
  useCollectionProgressList: () => useCollectionProgressListMock(),
}))

describe("CollectionProgressClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders the empty state when no tracked collections exist", () => {
    useCollectionProgressListMock.mockReturnValue({
      progressItems: [],
      isLoading: false,
      isEmpty: true,
    })

    render(<CollectionProgressClient />)

    expect(screen.getByText("No collections tracked")).toBeInTheDocument()
  })

  it("renders tracked collection cards", () => {
    useCollectionProgressListMock.mockReturnValue({
      progressItems: [
        {
          collectionId: 1,
          name: "Alien Collection",
          posterPath: null,
          backdropPath: null,
          watchedCount: 2,
          totalMovies: 4,
          percentage: 50,
          lastUpdated: 200,
        },
      ],
      isLoading: false,
      isEmpty: false,
    })

    render(<CollectionProgressClient />)

    expect(screen.getByText("Alien Collection")).toBeInTheDocument()
    expect(screen.getByText("50%")).toBeInTheDocument()
  })
})

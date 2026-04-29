import { useBulkListOperations } from "@/hooks/use-bulk-list-operations"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  addToList: vi.fn(),
  deleteList: vi.fn(),
  maybeWarnTraktManagedListEdit: vi.fn(),
  removeMediaFromList: vi.fn(),
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { uid: "user-1", isAnonymous: false },
  }),
}))

vi.mock("@/context/trakt-context", () => ({
  useOptionalTrakt: () => ({
    isConnected: true,
  }),
}))

vi.mock("@/lib/firebase/lists", () => ({
  addToList: (...args: unknown[]) => mocks.addToList(...args),
  deleteList: (...args: unknown[]) => mocks.deleteList(...args),
  removeMediaFromList: (...args: unknown[]) => mocks.removeMediaFromList(...args),
}))

vi.mock("@/lib/trakt-managed-edits", () => ({
  maybeWarnTraktManagedListEdit: (...args: unknown[]) =>
    mocks.maybeWarnTraktManagedListEdit(...args),
}))

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
  },
}))

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

describe("useBulkListOperations", () => {
  it("treats move requests with no valid target lists as a no-op", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(() => useBulkListOperations(), {
      wrapper: createWrapper(queryClient),
    })

    let transferResult:
      | {
          failedOperations: number
          totalOperations: number
        }
      | undefined

    await act(async () => {
      transferResult = await result.current.transferItems({
        sourceListId: "watchlist",
        targetListIds: ["watchlist", "watchlist"],
        mediaItems: [
          {
            id: 123,
            media_type: "movie",
            title: "Spirited Away",
            poster_path: null,
          },
        ],
        mode: "move",
      })
    })

    expect(transferResult).toEqual({
      failedOperations: 0,
      totalOperations: 0,
    })
    expect(mocks.addToList).not.toHaveBeenCalled()
    expect(mocks.removeMediaFromList).not.toHaveBeenCalled()
    expect(mocks.maybeWarnTraktManagedListEdit).not.toHaveBeenCalled()
    expect(invalidateQueriesSpy).not.toHaveBeenCalled()
  })
})

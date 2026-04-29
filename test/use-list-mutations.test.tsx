import { useListMutations } from "@/hooks/use-list-mutations"
import { queryKeys } from "@/lib/react-query/query-keys"
import type { ListWriteMediaItem, UserList } from "@/types/list"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  addToList: vi.fn(),
  createList: vi.fn(),
  deleteList: vi.fn(),
  maybeWarnTraktManagedListEdit: vi.fn(),
  removeFromList: vi.fn(),
  removeMediaFromList: vi.fn(),
  updateList: vi.fn(),
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { uid: "user-1", isAnonymous: false },
  }),
}))

vi.mock("@/context/trakt-context", () => ({
  useOptionalTrakt: () => ({
    isConnected: false,
  }),
}))

vi.mock("@/lib/firebase/lists", () => ({
  addToList: (...args: unknown[]) => mocks.addToList(...args),
  createList: (...args: unknown[]) => mocks.createList(...args),
  deleteList: (...args: unknown[]) => mocks.deleteList(...args),
  removeFromList: (...args: unknown[]) => mocks.removeFromList(...args),
  removeMediaFromList: (...args: unknown[]) => mocks.removeMediaFromList(...args),
  updateList: (...args: unknown[]) => mocks.updateList(...args),
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

function createMediaItem(): ListWriteMediaItem {
  return {
    id: 123,
    title: "Spirited Away",
    poster_path: null,
    media_type: "movie",
    addedAt: 111,
  }
}

describe("useListMutations", () => {
  it("uses the canonical media key in the default-list optimistic fallback", async () => {
    mocks.addToList.mockResolvedValue(true)
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    })
    const listQueryKey = queryKeys.firestore.lists("user-1")
    queryClient.setQueryData<UserList[]>(listQueryKey, [])

    const { result } = renderHook(() => useListMutations(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.addToList("watchlist", createMediaItem())
    })

    expect(queryClient.getQueryData<UserList[]>(listQueryKey)).toEqual([
      expect.objectContaining({
        id: "watchlist",
        items: {
          "movie-123": expect.objectContaining({
            id: 123,
            media_type: "movie",
            addedAt: 111,
          }),
        },
      }),
    ])
  })
})

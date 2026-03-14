import { useNotes } from "@/hooks/use-notes"
import { queryKeys } from "@/lib/react-query/query-keys"
import type { Note } from "@/types/note"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { Timestamp } from "firebase/firestore"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const deleteNoteMock = vi.fn()
const fetchNotesMock = vi.fn()
const setNoteMock = vi.fn()

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: {
      uid: "user-1",
      isAnonymous: false,
    },
    loading: false,
  }),
}))

vi.mock("@/lib/firebase/notes", () => ({
  deleteNote: (...args: unknown[]) => deleteNoteMock(...args),
  fetchNotes: (...args: unknown[]) => fetchNotesMock(...args),
  setNote: (...args: unknown[]) => setNoteMock(...args),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return {
    queryClient,
    Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )
    },
  }
}

function createDeferredPromise<T>() {
  let resolve!: (value: T) => void

  const promise = new Promise<T>((res) => {
    resolve = res
  })

  return { promise, resolve }
}

function createNote(overrides: Partial<Note>): Note {
  return {
    id: "episode-100-1-1",
    userId: "user-1",
    mediaId: 100,
    mediaType: "episode",
    content: "Episode note",
    mediaTitle: "Episode 1",
    posterPath: null,
    seasonNumber: 1,
    episodeNumber: 1,
    showId: 100,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  }
}

describe("useNotes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchNotesMock.mockResolvedValue(new Map<string, Note>())
    setNoteMock.mockResolvedValue(undefined)
    deleteNoteMock.mockResolvedValue(undefined)
  })

  it("saves episode notes for the same show without cache collisions", async () => {
    const { queryClient, Wrapper } = createWrapper()
    const firstSave = createDeferredPromise<void>()
    const secondSave = createDeferredPromise<void>()

    setNoteMock
      .mockImplementationOnce(() => firstSave.promise)
      .mockImplementationOnce(() => secondSave.promise)

    const { result } = renderHook(() => useNotes(), {
      wrapper: Wrapper,
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    let firstPromise!: Promise<void>
    let secondPromise!: Promise<void>

    await act(async () => {
      firstPromise = result.current.saveNote(
        "episode",
        100,
        "Episode 1 note",
        "Episode 1",
        undefined,
        null,
        1,
        1,
        100,
      )
      await Promise.resolve()
    })

    await act(async () => {
      secondPromise = result.current.saveNote(
        "episode",
        100,
        "Episode 2 note",
        "Episode 2",
        undefined,
        null,
        1,
        2,
        100,
      )
      await Promise.resolve()
    })

    const notesQueryKey = queryKeys.firestore.notes("user-1")

    await waitFor(() => {
      const notes = queryClient.getQueryData<Map<string, Note>>(notesQueryKey)
      expect(notes?.size).toBe(2)
      expect(notes?.get("episode-100-1-1")?.content).toBe("Episode 1 note")
      expect(notes?.get("episode-100-1-2")?.content).toBe("Episode 2 note")
    })

    expect(result.current.getNote("episode", 100, 1, 1)?.content).toBe(
      "Episode 1 note",
    )
    expect(result.current.getNote("episode", 100, 1, 2)?.content).toBe(
      "Episode 2 note",
    )

    fetchNotesMock.mockResolvedValue(
      new Map<string, Note>([
        ["episode-100-1-1", createNote({ content: "Episode 1 note" })],
        [
          "episode-100-1-2",
          createNote({
            id: "episode-100-1-2",
            content: "Episode 2 note",
            mediaTitle: "Episode 2",
            episodeNumber: 2,
          }),
        ],
      ]),
    )

    firstSave.resolve(undefined)
    secondSave.resolve(undefined)

    await act(async () => {
      await Promise.all([firstPromise, secondPromise])
    })
  })

  it("removes episode notes using season and episode metadata", async () => {
    const { queryClient, Wrapper } = createWrapper()
    const deleteDeferred = createDeferredPromise<void>()

    fetchNotesMock.mockResolvedValue(
      new Map<string, Note>([
        [
          "episode-100-1-2",
          createNote({
            id: "episode-100-1-2",
            content: "Episode 2 note",
            mediaTitle: "Episode 2",
            episodeNumber: 2,
          }),
        ],
      ]),
    )
    deleteNoteMock.mockImplementationOnce(() => deleteDeferred.promise)

    const { result } = renderHook(() => useNotes(), {
      wrapper: Wrapper,
    })

    await waitFor(() => {
      expect(result.current.getNote("episode", 100, 1, 2)?.content).toBe(
        "Episode 2 note",
      )
    })

    let removePromise!: Promise<void>

    await act(async () => {
      removePromise = result.current.removeNote("episode", 100, 1, 2)
      await Promise.resolve()
    })

    expect(deleteNoteMock).toHaveBeenCalledWith("user-1", "episode", 100, 1, 2)

    await waitFor(() => {
      const notes = queryClient.getQueryData<Map<string, Note>>(
        queryKeys.firestore.notes("user-1"),
      )
      expect(notes?.size).toBe(0)
      expect(result.current.getNote("episode", 100, 1, 2)).toBeNull()
    })

    fetchNotesMock.mockResolvedValue(new Map<string, Note>())
    deleteDeferred.resolve(undefined)

    await act(async () => {
      await removePromise
    })
  })
})

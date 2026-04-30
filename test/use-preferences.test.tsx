import { PreferencesBootstrap } from "@/components/preferences-bootstrap"
import { usePosterOverrides } from "@/hooks/use-poster-overrides"
import { usePreferences } from "@/hooks/use-preferences"
import { DEFAULT_PREFERENCES } from "@/lib/user-preferences"
import { queryKeys } from "@/lib/react-query/query-keys"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  authState: {
    user: {
      uid: "user-1",
      isAnonymous: false,
    },
    loading: false,
  } as {
    user: { uid: string; isAnonymous?: boolean } | null
    loading: boolean
  },
  clearPosterOverride: vi.fn(),
  doc: vi.fn(),
  getFirebaseDb: vi.fn(() => ({ name: "db" })),
  latestSnapshotError: null as null | ((error: Error) => void),
  latestSnapshotNext: null as null | ((snapshot: {
    exists: () => boolean
    data: () => unknown
  }) => void),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(),
  setPosterOverride: vi.fn(),
  unsubscribe: vi.fn(),
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => mocks.authState,
}))

vi.mock("@/lib/firebase/config", () => ({
  getFirebaseDb: () => mocks.getFirebaseDb(),
}))

vi.mock("@/lib/firebase/poster-overrides", () => ({
  clearPosterOverride: (...args: unknown[]) =>
    mocks.clearPosterOverride(...args),
  setPosterOverride: (...args: unknown[]) => mocks.setPosterOverride(...args),
}))

vi.mock("firebase/firestore", () => ({
  doc: (...args: unknown[]) => mocks.doc(...args),
  onSnapshot: (...args: unknown[]) => mocks.onSnapshot(...args),
  setDoc: (...args: unknown[]) => mocks.setDoc(...args),
}))

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <PreferencesBootstrap />
        {children}
      </QueryClientProvider>
    )
  }
}

function createDeferredPromise<T>() {
  let reject!: (reason?: unknown) => void
  let resolve!: (value: T | PromiseLike<T>) => void

  const promise = new Promise<T>((res, rej) => {
    reject = rej
    resolve = res
  })

  return { promise, reject, resolve }
}

function emitPreferencesSnapshot(
  data?: {
    preferences?: Record<string, unknown>
    region?: string
  },
) {
  if (!mocks.latestSnapshotNext) {
    throw new Error("No active preferences snapshot listener")
  }

  mocks.latestSnapshotNext({
    exists: () => data !== undefined,
    data: () => data,
  })
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

describe("usePreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.authState = {
      user: {
        uid: "user-1",
        isAnonymous: false,
      },
      loading: false,
    }
    mocks.latestSnapshotNext = null
    mocks.latestSnapshotError = null
    mocks.unsubscribe = vi.fn()
    mocks.doc.mockImplementation((_db: unknown, ...segments: string[]) =>
      segments.join("/"),
    )
    mocks.onSnapshot.mockImplementation(
      (
        _docRef: unknown,
        onNext: (snapshot: { exists: () => boolean; data: () => unknown }) => void,
        onError?: (error: Error) => void,
      ) => {
        mocks.latestSnapshotNext = onNext
        mocks.latestSnapshotError = onError ?? null
        return mocks.unsubscribe
      },
    )
    mocks.setDoc.mockResolvedValue(undefined)
    mocks.setPosterOverride.mockResolvedValue(undefined)
    mocks.clearPosterOverride.mockResolvedValue(undefined)
  })

  it("reports loading for the first authenticated bootstrap until the snapshot seeds the cache", async () => {
    const queryClient = createQueryClient()
    const { result } = renderHook(() => usePreferences(), {
      wrapper: createWrapper(queryClient),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES)

    await waitFor(() => {
      expect(mocks.onSnapshot).toHaveBeenCalledTimes(1)
    })

    act(() => {
      emitPreferencesSnapshot({
        preferences: {
          posterOverrides: { movie_42: "/custom.jpg" },
          showOriginalTitles: true,
        },
        region: "CA",
      })
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.region).toBe("CA")
    expect(result.current.preferences.showOriginalTitles).toBe(true)
    expect(result.current.preferences.posterOverrides).toEqual({
      movie_42: "/custom.jpg",
    })
    expect(
      queryClient.getQueryData(queryKeys.firestore.preferences("user-1")),
    ).toMatchObject({
      preferences: {
        posterOverrides: {
          movie_42: "/custom.jpg",
        },
      },
      region: "CA",
    })
  })

  it("reuses cached preferences across remounts so poster overrides resolve immediately", () => {
    const queryClient = createQueryClient()
    const renderValues: Array<string | null> = []

    queryClient.setQueryData(queryKeys.firestore.preferences("user-1"), {
      preferences: {
        ...DEFAULT_PREFERENCES,
        posterOverrides: {
          movie_42: "/cached-poster.jpg",
        },
      },
      region: "US",
    })

    function usePosterPath() {
      const { resolvePosterPath } = usePosterOverrides()
      const resolvedPosterPath = resolvePosterPath("movie", 42, "/default.jpg")
      renderValues.push(resolvedPosterPath)
      return resolvedPosterPath
    }

    const firstRender = renderHook(() => usePosterPath(), {
      wrapper: createWrapper(queryClient),
    })

    expect(firstRender.result.current).toBe("/cached-poster.jpg")

    firstRender.unmount()

    const secondRender = renderHook(() => usePosterPath(), {
      wrapper: createWrapper(queryClient),
    })

    expect(secondRender.result.current).toBe("/cached-poster.jpg")
    expect(renderValues).not.toContain("/default.jpg")
  })

  it("optimistically updates shared preference cache and rolls back on failure", async () => {
    const queryClient = createQueryClient()
    const updateDeferred = createDeferredPromise<void>()
    const queryKey = queryKeys.firestore.preferences("user-1")

    queryClient.setQueryData(queryKey, {
      preferences: {
        ...DEFAULT_PREFERENCES,
        showOriginalTitles: false,
      },
      region: "US",
    })
    mocks.setDoc.mockImplementationOnce(() => updateDeferred.promise)

    const { result } = renderHook(() => usePreferences(), {
      wrapper: createWrapper(queryClient),
    })

    let updatePromise!: Promise<void>

    await act(async () => {
      updatePromise = result.current.updatePreference("showOriginalTitles", true)
      await Promise.resolve()
    })

    expect(
      queryClient.getQueryData<{
        preferences: { showOriginalTitles: boolean }
      }>(queryKey)?.preferences.showOriginalTitles,
    ).toBe(true)

    const expectedError = new Error("Failed to update preference")

    await act(async () => {
      updateDeferred.reject(expectedError)
      await expect(updatePromise).rejects.toThrow(expectedError.message)
    })

    expect(
      queryClient.getQueryData<{
        preferences: { showOriginalTitles: boolean }
      }>(queryKey)?.preferences.showOriginalTitles,
    ).toBe(false)
  })

  it("optimistically updates poster override cache and rolls back on failure", async () => {
    const queryClient = createQueryClient()
    const overrideDeferred = createDeferredPromise<void>()
    const queryKey = queryKeys.firestore.preferences("user-1")

    queryClient.setQueryData(queryKey, {
      preferences: {
        ...DEFAULT_PREFERENCES,
        posterOverrides: {},
      },
      region: "US",
    })
    mocks.setPosterOverride.mockImplementationOnce(() => overrideDeferred.promise)

    const { result } = renderHook(() => usePreferences(), {
      wrapper: createWrapper(queryClient),
    })

    let updatePromise!: Promise<void>

    await act(async () => {
      updatePromise = result.current.setPosterOverride(
        "movie",
        42,
        "/custom-poster.jpg",
      )
      await Promise.resolve()
    })

    expect(
      queryClient.getQueryData<{
        preferences: { posterOverrides?: Record<string, string> }
      }>(queryKey)?.preferences.posterOverrides,
    ).toEqual({
      movie_42: "/custom-poster.jpg",
    })

    const expectedError = new Error("Failed to update poster override")

    await act(async () => {
      overrideDeferred.reject(expectedError)
      await expect(updatePromise).rejects.toThrow(expectedError.message)
    })

    expect(
      queryClient.getQueryData<{
        preferences: { posterOverrides?: Record<string, string> }
      }>(queryKey)?.preferences.posterOverrides,
    ).toEqual({})
  })
})

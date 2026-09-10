import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  showRuntime: null as number | null,
  movieRuntime: null as number | null,
}))

vi.mock("firebase/firestore", () => ({
  doc: (...args: unknown[]) => ({ path: args.join("/") }),
  setDoc: (...args: unknown[]) => mocks.setDoc(...args),
  updateDoc: (...args: unknown[]) => mocks.updateDoc(...args),
}))

vi.mock("@/lib/firebase/config", () => ({
  getFirebaseDb: () => ({}),
}))

vi.mock("@/app/actions", () => ({
  fetchMeasuredShowRuntime: () => Promise.resolve(mocks.showRuntime),
  fetchMovieDetails: () =>
    Promise.resolve(
      mocks.movieRuntime == null ? null : { runtime: mocks.movieRuntime },
    ),
}))

vi.mock("@/lib/react-query/rate-limited-query", () => ({
  enqueueRateLimitedRequest: (fn: (...args: never[]) => Promise<unknown>, ...args: never[]) =>
    fn(...args),
}))

import {
  backfillWatchTimeRuntimes,
  resetWatchTimeBackfillBudget,
} from "@/lib/watch-time-backfill"

function settle(input: {
  unstampedEpisodes?: Parameters<typeof backfillWatchTimeRuntimes>[0]["unstampedEpisodes"]
  unstampedListItems?: Parameters<typeof backfillWatchTimeRuntimes>[0]["unstampedListItems"]
}): Promise<boolean> {
  return new Promise((resolve) => {
    backfillWatchTimeRuntimes({
      userId: "user-1",
      unstampedEpisodes: input.unstampedEpisodes ?? [],
      unstampedListItems: input.unstampedListItems ?? [],
      onStampsSettled: resolve,
    })
  })
}

describe("backfillWatchTimeRuntimes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetWatchTimeBackfillBudget()
    mocks.showRuntime = 42
    mocks.movieRuntime = 120
  })

  it("stamps one show lookup across all its episodes", async () => {
    const didStamp = await settle({
      unstampedEpisodes: [
        { tvShowId: 100, episodeKey: "1_1", watchedAt: 1 },
        { tvShowId: 100, episodeKey: "1_2", watchedAt: 2 },
      ],
    })

    expect(didStamp).toBe(true)
    expect(mocks.setDoc).toHaveBeenCalledTimes(2)
    expect(mocks.setDoc).toHaveBeenCalledWith(
      expect.anything(),
      { episodes: { "1_1": { runtimeMinutes: 42 } } },
      { merge: true },
    )
  })

  it("stamps movie runtimes and skips unresolved titles without stamping fallbacks", async () => {
    mocks.movieRuntime = null

    const didStamp = await settle({
      unstampedListItems: [
        {
          listId: "already-watched",
          itemKey: "movie-1",
          mediaType: "movie",
          mediaId: 1,
          addedAt: 1,
        },
      ],
    })

    expect(didStamp).toBe(false)
    expect(mocks.updateDoc).not.toHaveBeenCalled()
  })

  it("dedupes lookups within a session", async () => {
    await settle({
      unstampedEpisodes: [{ tvShowId: 100, episodeKey: "1_1", watchedAt: 1 }],
    })
    mocks.setDoc.mockClear()

    const didStamp = await settle({
      unstampedEpisodes: [{ tvShowId: 100, episodeKey: "1_2", watchedAt: 2 }],
    })

    expect(didStamp).toBe(false)
    expect(mocks.setDoc).not.toHaveBeenCalled()
  })

  it("caps lookups at the session budget", async () => {
    const episodes = Array.from({ length: 12 }, (_, i) => ({
      tvShowId: 1000 + i,
      episodeKey: "1_1",
      watchedAt: 1,
    }))

    await settle({ unstampedEpisodes: episodes })

    // 10 shows stamped, 2 over budget untouched.
    expect(mocks.setDoc).toHaveBeenCalledTimes(10)
  })
})

import { CancelledError } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const BASE_TIME = new Date("2026-01-01T00:00:00.000Z")

type QueueModule = typeof import("@/lib/react-query/rate-limited-query")

function createDeferred<T>() {
  let reject!: (error?: unknown) => void
  let resolve!: (value: T) => void

  const promise = new Promise<T>((nextResolve, nextReject) => {
    reject = nextReject
    resolve = nextResolve
  })

  return {
    promise,
    reject,
    resolve,
  }
}

async function flushMicrotasks() {
  await Promise.resolve()
  await Promise.resolve()
}

let queueModule: QueueModule | null = null

async function loadQueueModule() {
  queueModule = await import("@/lib/react-query/rate-limited-query")
  return queueModule
}

describe("rate-limited query queue", () => {
  beforeEach(() => {
    queueModule = null
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(BASE_TIME)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("starts the first ten requests immediately and delays the next batch by 300ms", async () => {
    const { createRateLimitedQueryFn } = await loadQueueModule()
    const startedAt: number[] = []

    const queuedCalls = Array.from({ length: 11 }, (_, index) =>
      createRateLimitedQueryFn(async () => {
        startedAt.push(Date.now())
        return index
      }),
    )

    const resultsPromise = Promise.all(queuedCalls.map((call) => call()))

    await flushMicrotasks()

    expect(startedAt).toHaveLength(10)
    expect(startedAt).toEqual(Array.from({ length: 10 }, () => BASE_TIME.getTime()))

    await vi.advanceTimersByTimeAsync(299)
    expect(startedAt).toHaveLength(10)

    await vi.advanceTimersByTimeAsync(1)

    await expect(resultsPromise).resolves.toEqual(
      Array.from({ length: 11 }, (_, index) => index),
    )
    expect(startedAt).toHaveLength(11)
    expect(startedAt[10]).toBe(BASE_TIME.getTime() + 300)
  })

  it("forwards query function arguments through the rate-limited wrapper", async () => {
    const { createRateLimitedQueryFn } = await loadQueueModule()
    const context = {
      client: {},
      meta: { source: "test" },
      pageParam: 3,
      queryKey: ["calendar", 42] as const,
      signal: new AbortController().signal,
    }

    const wrappedQueryFn = createRateLimitedQueryFn(
      async (receivedContext: typeof context) => receivedContext,
    )

    const resultPromise = wrappedQueryFn(context)

    await flushMicrotasks()

    await expect(resultPromise).resolves.toBe(context)
  })

  it("propagates request errors without stalling later queued work", async () => {
    const { createRateLimitedQueryFn } = await loadQueueModule()
    const boom = new Error("boom")
    const started: number[] = []

    const queuedCalls = Array.from({ length: 12 }, (_, index) =>
      createRateLimitedQueryFn(async () => {
        started.push(index)

        if (index === 2) {
          throw boom
        }

        return index * 2
      }),
    )

    const settledPromise = Promise.allSettled(queuedCalls.map((call) => call()))

    await flushMicrotasks()
    expect(started).toEqual(Array.from({ length: 10 }, (_, index) => index))

    await vi.advanceTimersByTimeAsync(300)

    const settled = await settledPromise

    expect(started).toEqual(Array.from({ length: 12 }, (_, index) => index))
    expect(settled[2]).toMatchObject({
      reason: boom,
      status: "rejected",
    })
    expect(settled[11]).toMatchObject({
      status: "fulfilled",
      value: 22,
    })
  })

  it("rejects queued work with cancellation on clear and accepts fresh work after the active batch finishes", async () => {
    const { clearRateLimitedRequestQueue, createRateLimitedQueryFn } =
      await loadQueueModule()
    const started: number[] = []
    const firstBatch = Array.from({ length: 10 }, () => createDeferred<number>())

    const queuedCalls = [
      ...firstBatch.map((deferred, index) =>
        createRateLimitedQueryFn(async () => {
          started.push(index)
          return deferred.promise
        }),
      ),
      createRateLimitedQueryFn(async () => {
        started.push(10)
        return 10
      }),
    ]

    const pendingPromises = queuedCalls.map((call) => call())

    await flushMicrotasks()
    expect(started).toEqual(Array.from({ length: 10 }, (_, index) => index))

    clearRateLimitedRequestQueue()

    await expect(pendingPromises[10]).rejects.toBeInstanceOf(CancelledError)
    expect(started).toEqual(Array.from({ length: 10 }, (_, index) => index))

    firstBatch.forEach((deferred, index) => {
      deferred.resolve(index)
    })

    await vi.advanceTimersByTimeAsync(0)
    await expect(Promise.all(pendingPromises.slice(0, 10))).resolves.toEqual(
      Array.from({ length: 10 }, (_, index) => index),
    )

    const freshCall = createRateLimitedQueryFn(async () => {
      started.push(99)
      return "fresh"
    })

    const freshPromise = freshCall()

    await vi.advanceTimersByTimeAsync(0)

    await expect(freshPromise).resolves.toBe("fresh")
    expect(started).toContain(99)
  })
})

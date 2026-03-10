import { parseAggregationCount } from "@/lib/firebase/server-firestore"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const firestoreServerApiMocks = vi.hoisted(() => ({
  getFirebaseServiceAccountConfigMock: vi.fn(),
  getGoogleAccessTokenMock: vi.fn(),
}))

vi.mock("@/lib/firebase/server-api", () => ({
  getFirebaseServiceAccountConfig:
    firestoreServerApiMocks.getFirebaseServiceAccountConfigMock,
  getGoogleAccessToken: firestoreServerApiMocks.getGoogleAccessTokenMock,
}))

function createAbortableFetchMock() {
  return vi.fn((_: string, init?: RequestInit) => {
    const signal = init?.signal

    return new Promise<Response>((_, reject) => {
      signal?.addEventListener(
        "abort",
        () => reject(new DOMException("The operation was aborted.", "AbortError")),
        { once: true },
      )
    })
  })
}

describe("firebase server firestore helpers", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useRealTimers()
    firestoreServerApiMocks.getFirebaseServiceAccountConfigMock.mockReset()
    firestoreServerApiMocks.getGoogleAccessTokenMock.mockReset()
    firestoreServerApiMocks.getFirebaseServiceAccountConfigMock.mockReturnValue({
      clientEmail: "service-account@example.com",
      privateKey: "private-key",
      projectId: "showseek-project",
    })
    firestoreServerApiMocks.getGoogleAccessTokenMock.mockResolvedValue(
      "google-access-token",
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("parses Firestore aggregation count payloads", () => {
    const payload = [
      JSON.stringify({
        result: {
          aggregateFields: {
            total: {
              integerValue: "7",
            },
          },
        },
      }),
      "",
    ].join("\n")

    expect(parseAggregationCount(payload)).toBe(7)
  })

  it("returns zero when the aggregation payload is empty", () => {
    expect(parseAggregationCount("")).toBe(0)
    expect(parseAggregationCount("{}")).toBe(0)
  })

  it("passes an AbortSignal when fetching the Firestore user document", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          fields: {
            premium: {
              mapValue: {
                fields: {
                  isPremium: {
                    booleanValue: true,
                  },
                },
              },
            },
          },
        }),
        { status: 200 },
      )
    })

    vi.stubGlobal("fetch", fetchMock)

    const { getUserPremiumStatus } = await import(
      "../lib/firebase/server-firestore"
    )

    await expect(getUserPremiumStatus("user-1")).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://firestore.googleapis.com/v1/projects/showseek-project/databases/(default)/documents/users/user-1",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer google-access-token",
        }),
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it("times out the Firestore user document request", async () => {
    vi.useFakeTimers()
    vi.stubGlobal("fetch", createAbortableFetchMock())

    const { getUserPremiumStatus } = await import(
      "../lib/firebase/server-firestore"
    )

    const requestPromise = getUserPremiumStatus("user-1")
    const rejection = expect(requestPromise).rejects.toThrow(
      "Firestore user document request timed out after 10000ms",
    )
    await vi.advanceTimersByTimeAsync(10_000)

    await rejection
  })

  it("passes an AbortSignal when counting custom lists", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        [
          JSON.stringify({
            result: {
              aggregateFields: {
                total: {
                  integerValue: "3",
                },
              },
            },
          }),
          "",
        ].join("\n"),
        { status: 200 },
      )
    })

    vi.stubGlobal("fetch", fetchMock)

    const { countCustomLists } = await import("../lib/firebase/server-firestore")

    await expect(countCustomLists("user-1")).resolves.toBe(3)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://firestore.googleapis.com/v1/projects/showseek-project/databases/(default)/documents/users/user-1:runAggregationQuery",
      expect.objectContaining({
        body: expect.any(String),
        headers: expect.objectContaining({
          Authorization: "Bearer google-access-token",
          "Content-Type": "application/json",
        }),
        method: "POST",
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it("times out the Firestore custom list count request", async () => {
    vi.useFakeTimers()
    vi.stubGlobal("fetch", createAbortableFetchMock())

    const { countCustomLists } = await import("../lib/firebase/server-firestore")

    const requestPromise = countCustomLists("user-1")
    const rejection = expect(requestPromise).rejects.toThrow(
      "Firestore custom list count request timed out after 10000ms",
    )
    await vi.advanceTimersByTimeAsync(10_000)

    await rejection
  })
})

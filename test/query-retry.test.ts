import {
  isQueryCancellationError,
  shouldRetryQueryRequest,
} from "@/lib/react-query/query-retry"
import { CancelledError } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"

describe("query retry helpers", () => {
  it("does not retry CancelledError failures", () => {
    const error = new CancelledError()

    expect(isQueryCancellationError(error)).toBe(true)
    expect(shouldRetryQueryRequest(0, error)).toBe(false)
  })

  it("does not retry AbortError failures", () => {
    const error = Object.assign(new Error("The operation was aborted."), {
      name: "AbortError",
    })

    expect(isQueryCancellationError(error)).toBe(true)
    expect(shouldRetryQueryRequest(0, error)).toBe(false)
  })

  it("retries non-cancellation failures once", () => {
    const error = new Error("boom")

    expect(isQueryCancellationError(error)).toBe(false)
    expect(shouldRetryQueryRequest(0, error)).toBe(true)
    expect(shouldRetryQueryRequest(1, error)).toBe(false)
  })
})

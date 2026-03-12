import { CancelledError } from "@tanstack/react-query"

const MAX_QUERY_RETRIES = 1

export function isQueryCancellationError(error: unknown): boolean {
  return (
    error instanceof CancelledError ||
    (error instanceof Error && error.name === "AbortError")
  )
}

export function shouldRetryQueryRequest(
  failureCount: number,
  error: unknown,
): boolean {
  if (isQueryCancellationError(error)) {
    return false
  }

  return failureCount < MAX_QUERY_RETRIES
}

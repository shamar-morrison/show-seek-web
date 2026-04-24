const IMDB_IMPORT_ERROR_MESSAGE_BY_CODE: Record<string, string> = {
  "failed-precondition":
    "IMDb import is not configured on the backend yet. Please try again later.",
  "not-found":
    "IMDb import is not available on the backend yet. Please try again later.",
  "permission-denied": "IMDb import requires a premium account.",
  unauthenticated: "Please sign in again before importing IMDb data.",
  unavailable:
    "IMDb import is temporarily unavailable. Please try again later.",
}

function normalizeErrorCode(code: unknown): string | null {
  if (typeof code !== "string") {
    return null
  }

  const normalized = code.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  return normalized.startsWith("functions/")
    ? normalized.slice("functions/".length)
    : normalized
}

function extractImportErrorCode(error: unknown): string | null {
  if (error instanceof Error) {
    const typedError = error as Error & { cause?: unknown; code?: unknown }
    const directCode = normalizeErrorCode(typedError.code)
    if (directCode) {
      return directCode
    }

    if (typedError.cause && typeof typedError.cause === "object") {
      const causeCode = normalizeErrorCode(
        (typedError.cause as { code?: unknown }).code,
      )
      if (causeCode) {
        return causeCode
      }
    }
  }

  if (error && typeof error === "object") {
    return normalizeErrorCode((error as { code?: unknown }).code)
  }

  return null
}

export function getImdbImportErrorCode(error: unknown): string | null {
  return extractImportErrorCode(error)
}

export function getImdbImportErrorMessage(error: unknown): string {
  const code = extractImportErrorCode(error)
  if (code && IMDB_IMPORT_ERROR_MESSAGE_BY_CODE[code]) {
    return IMDB_IMPORT_ERROR_MESSAGE_BY_CODE[code]
  }

  return "IMDb import failed. Please try again."
}

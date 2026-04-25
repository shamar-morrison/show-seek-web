"use client"

import { getFirebaseAuth } from "@/lib/firebase/config"
import type {
  EnrichmentOptions,
  EnrichmentStatus,
  SyncErrorCategory,
  SyncStatus,
} from "@/types/trakt"

const SYNC_ERROR_CATEGORIES = new Set<SyncErrorCategory>([
  "auth_invalid",
  "internal",
  "locked_account",
  "storage_limit",
  "rate_limited",
  "upstream_blocked",
  "upstream_unavailable",
])

const OAUTH_CONNECTION_POLL_INTERVAL_MS = 1000
const OAUTH_CONNECTION_TIMEOUT_MS = 5 * 60 * 1000
const OAUTH_POPUP_CLOSED_GRACE_MS = 10000

type OAuthWindowHandle = {
  openedPopup: Window | null
  usedFallbackTab: boolean
}

type OAuthConnectionWaitOptions = {
  closedGraceMs?: number
  pollIntervalMs?: number
  timeoutMs?: number
}

function isSyncErrorCategory(value: unknown): value is SyncErrorCategory {
  return (
    typeof value === "string" &&
    SYNC_ERROR_CATEGORIES.has(value as SyncErrorCategory)
  )
}

function isActiveSyncStatus(status?: SyncStatus["status"]): boolean {
  return (
    status === "queued" || status === "in_progress" || status === "retrying"
  )
}

function isActiveEnrichmentStatus(
  status?: EnrichmentStatus["status"],
): boolean {
  return (
    status === "queued" || status === "in_progress" || status === "retrying"
  )
}

function createTimeoutSignal(timeoutMs: number): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(timeoutMs)
  }

  if (typeof AbortController === "undefined") {
    return undefined
  }

  const controller = new AbortController()
  const timeoutError = new Error("TimeoutError")
  timeoutError.name = "TimeoutError"

  setTimeout(() => controller.abort(timeoutError), timeoutMs)
  return controller.signal
}

function combineAbortSignals(
  ...signals: Array<AbortSignal | undefined>
): AbortSignal | undefined {
  const activeSignals = signals.filter(
    (signal): signal is AbortSignal => signal !== undefined,
  )

  if (activeSignals.length <= 1) {
    return activeSignals[0]
  }

  const controller = new AbortController()
  const abort = (signal: AbortSignal) => {
    if (controller.signal.aborted) return
    controller.abort(signal.reason)
  }

  activeSignals.forEach((signal) => {
    if (signal.aborted) {
      abort(signal)
      return
    }

    signal.addEventListener("abort", () => abort(signal), { once: true })
  })

  return controller.signal
}

async function parseJsonSafely(
  response: Response,
): Promise<Record<string, unknown> | undefined> {
  try {
    return (await response.json()) as Record<string, unknown>
  } catch {
    return undefined
  }
}

async function requireAuthenticatedHeaders() {
  const currentUser = getFirebaseAuth().currentUser

  if (!currentUser || currentUser.isAnonymous) {
    throw new Error("Must be logged in to use Trakt")
  }

  const idToken = await currentUser.getIdToken()

  return {
    currentUser,
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
  }
}

export class TraktRequestError extends Error {
  category?: SyncErrorCategory
  nextAllowedEnrichAt?: string
  nextAllowedSyncAt?: string
  responseBody?: Record<string, unknown>

  constructor(
    message: string,
    options: {
      category?: SyncErrorCategory
      nextAllowedEnrichAt?: string
      nextAllowedSyncAt?: string
      responseBody?: Record<string, unknown>
    } = {},
  ) {
    super(message)
    this.name = "TraktRequestError"
    this.category = options.category
    this.nextAllowedEnrichAt = options.nextAllowedEnrichAt
    this.nextAllowedSyncAt = options.nextAllowedSyncAt
    this.responseBody = options.responseBody
  }
}

async function buildRequestError(
  response: Response,
  fallbackMessage: string,
): Promise<TraktRequestError> {
  const responseBody = await parseJsonSafely(response)
  const message =
    (typeof responseBody?.errorMessage === "string"
      ? responseBody.errorMessage
      : "") ||
    (typeof responseBody?.error === "string" ? responseBody.error : "") ||
    fallbackMessage

  return new TraktRequestError(message, {
    category: isSyncErrorCategory(responseBody?.errorCategory)
      ? responseBody.errorCategory
      : undefined,
    nextAllowedEnrichAt:
      typeof responseBody?.nextAllowedEnrichAt === "string"
        ? responseBody.nextAllowedEnrichAt
        : undefined,
    nextAllowedSyncAt:
      typeof responseBody?.nextAllowedSyncAt === "string"
        ? responseBody.nextAllowedSyncAt
        : undefined,
    responseBody,
  })
}

async function traktFetch<T>(
  path:
    | "/api/trakt/oauth/start"
    | "/api/trakt/sync"
    | "/api/trakt/disconnect"
    | "/api/trakt/enrich",
  options: {
    body?: Record<string, unknown>
    fallbackMessage: string
    method?: "GET" | "POST"
    signal?: AbortSignal
    timeoutMs?: number
  },
): Promise<T> {
  const { headers } = await requireAuthenticatedHeaders()
  const signal = combineAbortSignals(
    options.signal,
    createTimeoutSignal(options.timeoutMs ?? 10000),
  )
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    signal,
  })

  if (!response.ok) {
    throw await buildRequestError(response, options.fallbackMessage)
  }

  const contentLength = response.headers.get("content-length")
  const contentType = response.headers.get("content-type")

  if (
    response.status === 204 ||
    contentLength === "0" ||
    !contentType?.trim()
  ) {
    return undefined as T
  }

  return (await response.json()) as T
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function openOAuthWindow(authUrl: string): OAuthWindowHandle {
  if (typeof window === "undefined") {
    return {
      openedPopup: null,
      usedFallbackTab: false,
    }
  }

  const popup = window.open(
    authUrl,
    "showseek-trakt-oauth",
    "popup=yes,width=520,height=720",
  )

  if (!popup) {
    window.open(authUrl, "_blank", "noopener,noreferrer")
    return {
      openedPopup: null,
      usedFallbackTab: true,
    }
  }

  try {
    popup.opener = null
  } catch {
    // Some browser contexts block writing opener. Keep the window handle so
    // closing the OAuth popup still exits the connection wait.
  }

  return {
    openedPopup: popup,
    usedFallbackTab: false,
  }
}

async function waitForOAuthConnection(
  windowHandle: OAuthWindowHandle,
  options: OAuthConnectionWaitOptions = {},
): Promise<SyncStatus> {
  if (typeof window === "undefined") {
    return checkSyncStatus()
  }

  const timeoutMs = options.timeoutMs ?? OAUTH_CONNECTION_TIMEOUT_MS
  const pollIntervalMs =
    options.pollIntervalMs ?? OAUTH_CONNECTION_POLL_INTERVAL_MS
  const closedGraceMs = options.closedGraceMs ?? OAUTH_POPUP_CLOSED_GRACE_MS
  const startedAt = Date.now()
  let popupClosedAt: number | null = null
  let lastError: unknown

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const status = await checkSyncStatus()

      if (status.connected) {
        return status
      }
    } catch (error) {
      lastError = error
    }

    const popupClosed = Boolean(
      windowHandle.openedPopup && windowHandle.openedPopup.closed,
    )

    if (popupClosed && popupClosedAt === null) {
      popupClosedAt = Date.now()
    }

    if (popupClosedAt !== null && Date.now() - popupClosedAt >= closedGraceMs) {
      break
    }

    await sleep(pollIntervalMs)
  }

  if (lastError instanceof Error) {
    throw lastError
  }

  throw new Error(
    windowHandle.usedFallbackTab
      ? "Trakt connection was not confirmed. Return to ShowSeek and try again after completing authorization."
      : "Trakt connection was not confirmed. Please finish the Trakt authorization and try again.",
  )
}

export async function initiateOAuthFlow(
  options?: OAuthConnectionWaitOptions,
): Promise<SyncStatus> {
  const payload = await traktFetch<{ authUrl?: string }>(
    "/api/trakt/oauth/start",
    {
      method: "POST",
      fallbackMessage: "Failed to start Trakt OAuth",
      timeoutMs: 10000,
    },
  )

  if (!payload.authUrl) {
    throw new Error("Missing Trakt OAuth URL from backend")
  }

  const windowHandle = openOAuthWindow(payload.authUrl)
  return waitForOAuthConnection(windowHandle, options)
}

export async function triggerSync(): Promise<void> {
  try {
    await traktFetch<unknown>("/api/trakt/sync", {
      method: "POST",
      fallbackMessage: "Sync failed",
      timeoutMs: 15000,
    })
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      const status = await checkSyncStatus()
      if (isActiveSyncStatus(status.status)) {
        return
      }
    }

    throw error
  }
}

export async function checkSyncStatus(
  options: { signal?: AbortSignal } = {},
): Promise<SyncStatus> {
  return traktFetch<SyncStatus>("/api/trakt/sync", {
    fallbackMessage: "Failed to check sync status",
    signal: options.signal,
    timeoutMs: 10000,
  })
}

export async function disconnectTrakt(): Promise<void> {
  await traktFetch<unknown>("/api/trakt/disconnect", {
    method: "POST",
    fallbackMessage: "Disconnect failed",
    timeoutMs: 10000,
  })
}

export async function triggerEnrichment(
  options?: EnrichmentOptions,
): Promise<void> {
  try {
    await traktFetch<unknown>("/api/trakt/enrich", {
      method: "POST",
      body: {
        includeEpisodes: options?.includeEpisodes ?? true,
        lists: options?.lists ?? ["already-watched", "watchlist", "favorites"],
      },
      fallbackMessage: "Enrichment failed",
      timeoutMs: 15000,
    })
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      const status = await checkEnrichmentStatus()
      if (isActiveEnrichmentStatus(status.status)) {
        return
      }
    }

    throw error
  }
}

export async function checkEnrichmentStatus(): Promise<EnrichmentStatus> {
  return traktFetch<EnrichmentStatus>("/api/trakt/enrich", {
    fallbackMessage: "Failed to check enrichment status",
    timeoutMs: 10000,
  })
}

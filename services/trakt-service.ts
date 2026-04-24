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

  return undefined
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
    timeoutMs?: number
  },
): Promise<T> {
  const { headers } = await requireAuthenticatedHeaders()
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    signal: createTimeoutSignal(options.timeoutMs ?? 10000),
  })

  if (!response.ok) {
    throw await buildRequestError(response, options.fallbackMessage)
  }

  return (await response.json()) as T
}

function openOAuthWindow(authUrl: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve()
  }

  const popup = window.open(
    authUrl,
    "showseek-trakt-oauth",
    "popup=yes,width=520,height=720,noopener,noreferrer",
  )

  if (!popup) {
    window.open(authUrl, "_blank", "noopener,noreferrer")
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const startedAt = Date.now()
    const interval = window.setInterval(() => {
      if (popup.closed || Date.now() - startedAt > 5 * 60 * 1000) {
        window.clearInterval(interval)
        resolve()
      }
    }, 500)
  })
}

export async function initiateOAuthFlow(): Promise<void> {
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

  await openOAuthWindow(payload.authUrl)
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

export async function checkSyncStatus(): Promise<SyncStatus> {
  return traktFetch<SyncStatus>("/api/trakt/sync", {
    fallbackMessage: "Failed to check sync status",
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

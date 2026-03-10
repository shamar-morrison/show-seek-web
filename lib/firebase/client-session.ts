"use client"

export type ServerSessionSyncStatus = "idle" | "pending" | "ready" | "error"

export interface ServerSessionSyncSnapshot {
  error: string | null
  status: ServerSessionSyncStatus
  uid: string | null
}

export interface ServerSessionSyncResult {
  error: string | null
  ok: boolean
  status: Extract<ServerSessionSyncStatus, "ready" | "error">
  uid: string
}

type ServerSessionSyncManagerArgs = {
  isCurrentUser?: () => boolean
  token: string
  uid: string
}

type ServerSessionSyncState = {
  inFlightPromise: Promise<ServerSessionSyncResult> | null
  inFlightSyncVersion: number | null
  inFlightToken: string | null
  inFlightUid: string | null
  snapshot: ServerSessionSyncSnapshot
  syncVersion: number
  syncedToken: string | null
  syncedUid: string | null
}

export async function syncServerSessionWithIdToken(
  idToken: string,
): Promise<void> {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
    credentials: "same-origin",
  })

  if (!response.ok) {
    let errorDetail = ""

    try {
      const data = (await response.json()) as Record<string, unknown>
      errorDetail =
        (typeof data.error === "string" ? data.error : "") ||
        (typeof data.message === "string" ? data.message : "") ||
        JSON.stringify(data)
    } catch {
      try {
        errorDetail = await response.text()
      } catch {
        errorDetail = "Unknown session creation error"
      }
    }

    throw new Error(
      errorDetail ||
        (response.status >= 500
          ? "Authentication service temporarily unavailable"
          : "Failed to create session"),
    )
  }
}

function getServerSessionSyncErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "We couldn't start your session. Please try again."
  }

  const normalizedMessage = error.message.trim()

  if (!normalizedMessage) {
    return "We couldn't start your session. Please try again."
  }

  return normalizedMessage.replace(
    /^Session creation failed \(Status \d+\):\s*/i,
    "",
  )
}

export function createServerSessionSyncManager(
  syncServerSession: (idToken: string) => Promise<void> = syncServerSessionWithIdToken,
  onSnapshotChange?: (snapshot: ServerSessionSyncSnapshot) => void,
) {
  let state: ServerSessionSyncState = {
    inFlightPromise: null,
    inFlightSyncVersion: null,
    inFlightToken: null,
    inFlightUid: null,
    snapshot: {
      error: null,
      status: "idle",
      uid: null,
    },
    syncVersion: 0,
    syncedToken: null,
    syncedUid: null,
  }

  const updateSnapshot = (
    nextSnapshot: ServerSessionSyncSnapshot,
  ): ServerSessionSyncSnapshot => {
    state = {
      ...state,
      snapshot: nextSnapshot,
    }
    onSnapshotChange?.(nextSnapshot)
    return nextSnapshot
  }

  return {
    clear() {
      const nextSyncVersion = state.syncVersion + 1
      const idleSnapshot = {
        error: null,
        status: "idle" as const,
        uid: null,
      }

      state = {
        inFlightPromise: null,
        inFlightSyncVersion: null,
        inFlightToken: null,
        inFlightUid: null,
        snapshot: idleSnapshot,
        syncVersion: nextSyncVersion,
        syncedToken: null,
        syncedUid: null,
      }
      onSnapshotChange?.(idleSnapshot)
    },
    getSnapshot(): ServerSessionSyncSnapshot {
      return state.snapshot
    },
    ensure({
      isCurrentUser = () => true,
      token,
      uid,
    }: ServerSessionSyncManagerArgs): Promise<ServerSessionSyncResult> {
      if (state.syncedUid === uid && state.syncedToken === token) {
        return Promise.resolve({
          error: null,
          ok: true,
          status: "ready",
          uid,
        })
      }

      if (
        state.inFlightPromise &&
        state.inFlightSyncVersion === state.syncVersion &&
        state.inFlightUid === uid &&
        state.inFlightToken === token
      ) {
        return state.inFlightPromise
      }

      const syncVersion = state.syncVersion
      updateSnapshot({
        error: null,
        status: "pending",
        uid,
      })

      const syncPromise = syncServerSession(token)
        .then(() => {
          if (state.syncVersion === syncVersion && isCurrentUser()) {
            updateSnapshot({
              error: null,
              status: "ready",
              uid,
            })

            state = {
              ...state,
              syncedToken: token,
              syncedUid: uid,
            }
          }

          return {
            error: null,
            ok: true,
            status: "ready" as const,
            uid,
          }
        })
        .catch((error) => {
          const errorMessage = getServerSessionSyncErrorMessage(error)

          if (state.syncVersion === syncVersion && isCurrentUser()) {
            updateSnapshot({
              error: errorMessage,
              status: "error",
              uid,
            })
          }

          return {
            error: errorMessage,
            ok: false,
            status: "error" as const,
            uid,
          }
        })
        .finally(() => {
          if (
            state.syncVersion === syncVersion &&
            state.inFlightSyncVersion === syncVersion &&
            state.inFlightUid === uid &&
            state.inFlightToken === token
          ) {
            state = {
              ...state,
              inFlightPromise: null,
              inFlightSyncVersion: null,
              inFlightToken: null,
              inFlightUid: null,
            }
          }
        })

      state = {
        ...state,
        inFlightPromise: syncPromise,
        inFlightSyncVersion: syncVersion,
        inFlightToken: token,
        inFlightUid: uid,
      }

      return syncPromise
    },
  }
}

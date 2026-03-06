import { describe, expect, it, vi } from "vitest"

import { createServerSessionSyncManager } from "@/lib/firebase/client-session"

describe("server session sync manager", () => {
  it("syncs a restored token once and does not resync the same token twice", async () => {
    const syncServerSession = vi.fn(async () => {})
    const syncManager = createServerSessionSyncManager(syncServerSession)

    await expect(
      syncManager.ensure({
        token: "token-1",
        uid: "user-1",
      }),
    ).resolves.toMatchObject({
      ok: true,
      status: "ready",
      uid: "user-1",
    })

    await expect(
      syncManager.ensure({
        token: "token-1",
        uid: "user-1",
      }),
    ).resolves.toMatchObject({
      ok: true,
      status: "ready",
      uid: "user-1",
    })

    expect(syncServerSession).toHaveBeenCalledTimes(1)
    expect(syncServerSession).toHaveBeenCalledWith("token-1")
    expect(syncManager.getSnapshot()).toEqual({
      error: null,
      status: "ready",
      uid: "user-1",
    })
  })

  it("resyncs when the Firebase ID token changes", async () => {
    const syncServerSession = vi.fn(async () => {})
    const syncManager = createServerSessionSyncManager(syncServerSession)

    await syncManager.ensure({
      token: "token-1",
      uid: "user-1",
    })

    await syncManager.ensure({
      token: "token-2",
      uid: "user-1",
    })

    expect(syncServerSession).toHaveBeenCalledTimes(2)
    expect(syncServerSession).toHaveBeenLastCalledWith("token-2")
    expect(syncManager.getSnapshot()).toEqual({
      error: null,
      status: "ready",
      uid: "user-1",
    })
  })

  it("reuses in-flight syncs for the same user and token and allows resync after clear", async () => {
    let resolveSync: (() => void) | null = null
    const syncServerSession = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveSync = resolve
          }),
      )
      .mockResolvedValue(undefined)
    const syncManager = createServerSessionSyncManager(syncServerSession)

    const firstSyncPromise = syncManager.ensure({
      token: "token-1",
      uid: "user-1",
    })
    const secondSyncPromise = syncManager.ensure({
      token: "token-1",
      uid: "user-1",
    })

    expect(syncServerSession).toHaveBeenCalledTimes(1)
    expect(secondSyncPromise).toBe(firstSyncPromise)

    resolveSync!()
    await expect(firstSyncPromise).resolves.toMatchObject({
      ok: true,
      status: "ready",
    })
    await expect(secondSyncPromise).resolves.toMatchObject({
      ok: true,
      status: "ready",
    })

    syncManager.clear()
    expect(syncManager.getSnapshot()).toEqual({
      error: null,
      status: "idle",
      uid: null,
    })

    await expect(
      syncManager.ensure({
        token: "token-1",
        uid: "user-1",
      }),
    ).resolves.toMatchObject({
      ok: true,
      status: "ready",
      uid: "user-1",
    })

    expect(syncServerSession).toHaveBeenCalledTimes(2)
  })

  it("records failed syncs and exposes the shared error state", async () => {
    const syncManager = createServerSessionSyncManager(
      vi.fn(async () => {
        throw new Error("Authentication service temporarily unavailable")
      }),
    )

    await expect(
      syncManager.ensure({
        token: "token-1",
        uid: "user-1",
      }),
    ).resolves.toEqual({
      error: "Authentication service temporarily unavailable",
      ok: false,
      status: "error",
      uid: "user-1",
    })

    expect(syncManager.getSnapshot()).toEqual({
      error: "Authentication service temporarily unavailable",
      status: "error",
      uid: "user-1",
    })
  })
})

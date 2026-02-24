import { beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/firebase/config", () => ({
  auth: { currentUser: null },
  db: {},
  functions: {},
}))

vi.mock("@/lib/premium-telemetry", () => ({
  createPremiumTelemetryPayload: vi.fn((payload) => payload),
  trackPremiumEvent: vi.fn(),
}))

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn(() => vi.fn()),
  signOut: vi.fn(async () => {}),
}))

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
}))

vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn(() => vi.fn(async () => ({ data: {} }))),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

type ReconcileResponse = {
  data: {
    isPremium: boolean
    source: "firestore" | "revenuecat" | "both" | "none"
    reconciledAt: string | null
  }
}

type PremiumStatus = "unknown" | "free" | "premium"

let authContext: typeof import("../context/auth-context")

beforeAll(async () => {
  authContext = await import("../context/auth-context")
})

describe("AuthContext premium reconciliation flows", () => {
  it("snapshot false then reconcile true flips state to premium", async () => {
    const reconcileCallable = vi.fn(async (): Promise<ReconcileResponse> => ({
      data: {
        isPremium: true,
        source: "revenuecat",
        reconciledAt: "2026-02-24T10:00:00.000Z",
      },
    }))

    let status: PremiumStatus = "unknown"
    const snapshotResolution = authContext.resolvePremiumStatusFromSnapshot({
      currentStatus: status,
      hasAttemptedReconcile: false,
      nextIsPremium: false,
    })

    status = snapshotResolution.nextStatus
    expect(status).toBe("free")
    expect(
      authContext.shouldStartPremiumReconcile({
        hasAttemptedReconcile: false,
        nextIsPremium: false,
      }),
    ).toBe(true)

    const response = await reconcileCallable()
    status = authContext.resolvePremiumStatusFromReconcileResult({
      isPremium: response.data.isPremium,
    })

    expect(status).toBe("premium")
    expect(reconcileCallable).toHaveBeenCalledTimes(1)
  })

  it("snapshot false then reconcile false remains free", async () => {
    const reconcileCallable = vi.fn(async (): Promise<ReconcileResponse> => ({
      data: {
        isPremium: false,
        source: "firestore",
        reconciledAt: "2026-02-24T10:00:00.000Z",
      },
    }))

    let status: PremiumStatus = "unknown"
    const snapshotResolution = authContext.resolvePremiumStatusFromSnapshot({
      currentStatus: status,
      hasAttemptedReconcile: false,
      nextIsPremium: false,
    })

    status = snapshotResolution.nextStatus
    expect(status).toBe("free")

    const response = await reconcileCallable()
    status = authContext.resolvePremiumStatusFromReconcileResult({
      isPremium: response.data.isPremium,
    })

    expect(status).toBe("free")
    expect(reconcileCallable).toHaveBeenCalledTimes(1)
  })

  it("listener error after premium does not downgrade", () => {
    const statusAfterError = authContext.resolvePremiumStatusOnListenerError({
      currentStatus: "premium",
    })

    expect(statusAfterError).toBe("premium")
  })

  it("reconcile runs once per user/session marker", () => {
    let hasAttemptedReconcile = false

    const firstAttempt = authContext.shouldStartPremiumReconcile({
      hasAttemptedReconcile,
      nextIsPremium: false,
    })

    expect(firstAttempt).toBe(true)
    hasAttemptedReconcile = true

    const secondAttempt = authContext.shouldStartPremiumReconcile({
      hasAttemptedReconcile,
      nextIsPremium: false,
    })

    expect(secondAttempt).toBe(false)
  })

  it("stale free snapshot cannot downgrade after reconcile success", () => {
    const result = authContext.resolvePremiumStatusFromSnapshot({
      currentStatus: "premium",
      hasAttemptedReconcile: true,
      nextIsPremium: false,
    })

    expect(result).toEqual({
      nextStatus: "premium",
      preserveCurrent: true,
    })
  })

  it("falls back to syncPremiumStatus when reconcile callable is not found", async () => {
    const primaryCallable = vi.fn(async () => {
      const error = new Error("not found")
      ;(error as { code?: string }).code = "functions/not-found"
      throw error
    })
    const fallbackCallable = vi.fn(async (): Promise<ReconcileResponse> => ({
      data: {
        isPremium: true,
        source: "revenuecat",
        reconciledAt: "2026-02-24T10:00:00.000Z",
      },
    }))

    let status: PremiumStatus = "free"

    await expect(primaryCallable()).rejects.toMatchObject({
      code: "functions/not-found",
    })
    expect(
      authContext.shouldFallbackToLegacyReconcileCallable("functions/not-found"),
    ).toBe(true)

    const fallbackResponse = await fallbackCallable()
    status = authContext.resolvePremiumStatusFromReconcileResult({
      isPremium: fallbackResponse.data.isPremium,
    })

    expect(status).toBe("premium")
    expect(fallbackCallable).toHaveBeenCalledTimes(1)
  })
})

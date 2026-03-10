import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/firebase/config", () => ({
  auth: { currentUser: null },
  db: {},
  functions: {},
}))

vi.mock("@/lib/firebase/client-session", () => ({
  createServerSessionSyncManager: vi.fn(() => ({
    clear: vi.fn(),
    ensure: vi.fn(async () => ({
      error: null,
      ok: true,
      status: "ready",
      uid: "user-1",
    })),
    getSnapshot: vi.fn(() => ({
      error: null,
      status: "idle",
      uid: null,
    })),
  })),
  syncServerSessionWithIdToken: vi.fn(async () => {}),
}))

vi.mock("firebase/auth", () => ({
  onIdTokenChanged: vi.fn(() => vi.fn()),
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

import {
  resolvePremiumStatusFromSnapshot,
  resolvePremiumStatusOnListenerError,
  shouldFallbackToLegacyReconcileCallable,
  shouldStartPremiumReconcile,
} from "../context/auth-context"

describe("premium reconciliation state helpers", () => {
  it("transitions unknown users to premium on premium snapshots", () => {
    const result = resolvePremiumStatusFromSnapshot({
      currentStatus: "unknown",
      hasAttemptedReconcile: false,
      nextIsPremium: true,
    })

    expect(result).toEqual({
      nextStatus: "premium",
      preserveCurrent: false,
    })
  })

  it("keeps premium state when a reconciled user receives a stale free snapshot", () => {
    const result = resolvePremiumStatusFromSnapshot({
      currentStatus: "premium",
      hasAttemptedReconcile: true,
      nextIsPremium: false,
    })

    expect(result).toEqual({
      nextStatus: "premium",
      preserveCurrent: true,
    })
  })

  it("transitions unknown/free users to free when snapshot is non-premium", () => {
    expect(
      resolvePremiumStatusFromSnapshot({
        currentStatus: "unknown",
        hasAttemptedReconcile: false,
        nextIsPremium: false,
      }),
    ).toEqual({
      nextStatus: "free",
      preserveCurrent: false,
    })

    expect(
      resolvePremiumStatusFromSnapshot({
        currentStatus: "free",
        hasAttemptedReconcile: true,
        nextIsPremium: false,
      }),
    ).toEqual({
      nextStatus: "free",
      preserveCurrent: false,
    })
  })

  it("preserves the current status on snapshot listener errors", () => {
    expect(
      resolvePremiumStatusOnListenerError({
        currentStatus: "premium",
      }),
    ).toBe("premium")
    expect(
      resolvePremiumStatusOnListenerError({
        currentStatus: "free",
      }),
    ).toBe("free")
    expect(
      resolvePremiumStatusOnListenerError({
        currentStatus: "unknown",
      }),
    ).toBe("free")
  })

  it("starts reconcile only for unresolved non-premium snapshots", () => {
    expect(
      shouldStartPremiumReconcile({
        hasAttemptedReconcile: false,
        nextIsPremium: false,
      }),
    ).toBe(true)

    expect(
      shouldStartPremiumReconcile({
        hasAttemptedReconcile: true,
        nextIsPremium: false,
      }),
    ).toBe(false)

    expect(
      shouldStartPremiumReconcile({
        hasAttemptedReconcile: false,
        nextIsPremium: true,
      }),
    ).toBe(false)
  })

  it("allows only one reconcile attempt per uid/session marker", () => {
    expect(
      shouldStartPremiumReconcile({
        hasAttemptedReconcile: false,
        nextIsPremium: false,
      }),
    ).toBe(true)
    expect(
      shouldStartPremiumReconcile({
        hasAttemptedReconcile: true,
        nextIsPremium: false,
      }),
    ).toBe(false)
  })

  it("falls back to legacy callable only for missing/unimplemented errors", () => {
    expect(
      shouldFallbackToLegacyReconcileCallable("functions/not-found"),
    ).toBe(true)
    expect(
      shouldFallbackToLegacyReconcileCallable("functions/unimplemented"),
    ).toBe(true)
    expect(
      shouldFallbackToLegacyReconcileCallable("functions/unavailable"),
    ).toBe(false)
    expect(shouldFallbackToLegacyReconcileCallable("unknown")).toBe(false)
  })
})

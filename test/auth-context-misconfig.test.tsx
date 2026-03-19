import { fireEvent, render, screen, waitFor } from "./utils"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

const {
  clearServerSessionSyncState,
  ensureServerSessionMock,
  onIdTokenChangedMock,
} = vi.hoisted(() => ({
  clearServerSessionSyncState: vi.fn(),
  ensureServerSessionMock: vi.fn(),
  onIdTokenChangedMock: vi.fn(() => vi.fn()),
}))

vi.mock("@/lib/firebase/config", () => ({
  getFirebaseAuth: vi.fn(() => {
    throw new Error("Firebase auth should not be requested when unavailable")
  }),
  getFirebaseClientConfigErrorMessage: vi.fn(
    () =>
      "Firebase client configuration is missing: NEXT_PUBLIC_FIREBASE_API_KEY.",
  ),
  getFirebaseDb: vi.fn(() => {
    throw new Error("Firestore should not be requested when unavailable")
  }),
  getFirebaseFunctions: vi.fn(() => {
    throw new Error("Firebase functions should not be requested when unavailable")
  }),
  isFirebaseClientConfigured: false,
}))

vi.mock("@/lib/premium-telemetry", () => ({
  createPremiumTelemetryPayload: vi.fn((payload) => payload),
  trackPremiumEvent: vi.fn(),
}))

vi.mock("@/lib/firebase/client-session", () => ({
  createServerSessionSyncManager: vi.fn(() => ({
    clear: clearServerSessionSyncState,
    ensure: ensureServerSessionMock,
    getSnapshot: vi.fn(() => ({
      error: null,
      status: "idle",
      uid: null,
    })),
  })),
  syncServerSessionWithIdToken: vi.fn(async () => {}),
}))

vi.mock("firebase/auth", () => ({
  onIdTokenChanged: onIdTokenChangedMock,
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
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import { AuthProvider, useAuth } from "../context/auth-context"

function AuthContextProbe() {
  const { ensureServerSession, firebaseAvailable, loading, user } = useAuth()
  const [ensureResult, setEnsureResult] = useState<string>("idle")

  return (
    <div>
      <p data-testid="auth-state">
        {JSON.stringify({
          firebaseAvailable,
          hasUser: user !== null,
          loading,
        })}
      </p>
      <button
        type="button"
        onClick={async () => {
          const result = await ensureServerSession()
          setEnsureResult(result.error ?? "ok")
        }}
      >
        Ensure session
      </button>
      <p data-testid="ensure-result">{ensureResult}</p>
    </div>
  )
}

describe("AuthProvider without Firebase client config", () => {
  it("renders children in a stable guest state and returns a controlled session error", async () => {
    render(
      <AuthProvider>
        <AuthContextProbe />
      </AuthProvider>,
    )

    expect(screen.getByTestId("auth-state")).toHaveTextContent(
      JSON.stringify({
        firebaseAvailable: false,
        hasUser: false,
        loading: false,
      }),
    )
    expect(onIdTokenChangedMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Ensure session" }))

    await waitFor(() => {
      expect(screen.getByTestId("ensure-result")).toHaveTextContent(
        "Firebase client configuration is missing: NEXT_PUBLIC_FIREBASE_API_KEY.",
      )
    })
    expect(clearServerSessionSyncState).toHaveBeenCalled()
  })
})

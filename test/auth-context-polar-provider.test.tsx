import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AuthProvider, useAuth } from "@/context/auth-context"
import { ReactNode } from "react"

const authMock = { currentUser: { uid: "user-test" } }
let snapshotListenerCallback: ((snapshot: any) => void) | null = null

vi.mock("@/lib/firebase/config", () => ({
  getFirebaseAuth: vi.fn(() => authMock),
  getFirebaseClientConfigErrorMessage: vi.fn(() => ""),
  getFirebaseDb: vi.fn(() => ({})),
  getFirebaseFunctions: vi.fn(() => ({})),
  isFirebaseClientConfigured: true,
}))

vi.mock("@/lib/firebase/client-session", () => ({
  createServerSessionSyncManager: vi.fn(() => ({
    clear: vi.fn(),
    ensure: vi.fn(async () => ({ ok: true, status: "ready", uid: "user-test" })),
    markReady: vi.fn(async () => ({ ok: true, status: "ready", uid: "user-test" })),
  })),
  syncServerSessionWithIdToken: vi.fn(async () => {}),
}))

vi.mock("firebase/auth", () => ({
  onIdTokenChanged: vi.fn((_auth, callback) => {
    callback({ uid: "user-test" })
    return vi.fn()
  }),
  signOut: vi.fn(async () => {}),
}))

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  onSnapshot: vi.fn((_ref, callback) => {
    snapshotListenerCallback = callback
    return vi.fn()
  }),
}))

vi.mock("nextjs-toploader/app", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe("AuthProvider Polar Provider State", () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  )

  it("exposes premiumProvider from user document snapshot", () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.premiumProvider).toBeNull()

    // Simulate Polar user document snapshot
    act(() => {
      snapshotListenerCallback?.({
        exists: () => true,
        data: () => ({
          uid: "user-test",
          premium: {
            isPremium: true,
            provider: "polar",
          },
        }),
      })
    })

    expect(result.current.isPremium).toBe(true)
    expect(result.current.premiumProvider).toBe("polar")
  })
})

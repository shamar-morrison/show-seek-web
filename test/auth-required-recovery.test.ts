import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/auth-modal", () => ({
  AuthModal: () => null,
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    ensureServerSession: vi.fn(),
    loading: false,
    user: null,
  }),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}))

import {
  resolveAuthRequiredRecoveryAction,
  sanitizeAuthRedirectPath,
  stripAuthRedirectParams,
} from "@/components/auth-required-recovery"

describe("auth-required recovery helpers", () => {
  it("repairs the session and returns to the protected route when a Firebase user already exists", () => {
    expect(
      resolveAuthRequiredRecoveryAction({
        authRequired: true,
        loading: false,
        pathname: "/",
        redirectPath: "/profile",
        search: "auth=required&redirect=%2Fprofile",
        serverSessionSync: {
          error: null,
          status: "idle",
          uid: null,
        },
        user: { isAnonymous: false },
      }),
    ).toEqual({
      clearUrl: "/",
      redirectTarget: "/profile",
      type: "repair-session",
    })
  })

  it("opens auth when no Firebase user exists and preserves the intended target", () => {
    expect(
      resolveAuthRequiredRecoveryAction({
        authRequired: true,
        loading: false,
        pathname: "/",
        redirectPath: "/profile",
        search: "auth=required&redirect=%2Fprofile",
        serverSessionSync: {
          error: null,
          status: "idle",
          uid: null,
        },
        user: null,
      }),
    ).toEqual({
      clearUrl: "/",
      redirectTarget: "/profile",
      type: "show-auth",
    })
  })

  it("waits for an existing shared session sync instead of triggering another repair", () => {
    expect(
      resolveAuthRequiredRecoveryAction({
        authRequired: true,
        loading: false,
        pathname: "/",
        redirectPath: "/profile",
        search: "auth=required&redirect=%2Fprofile",
        serverSessionSync: {
          error: null,
          status: "pending",
          uid: "user-1",
        },
        user: { isAnonymous: false, uid: "user-1" },
      }),
    ).toEqual({
      clearUrl: "/",
      redirectTarget: "/profile",
      type: "wait-for-session",
    })
  })

  it("redirects immediately when the shared session sync is already ready", () => {
    expect(
      resolveAuthRequiredRecoveryAction({
        authRequired: true,
        loading: false,
        pathname: "/",
        redirectPath: "/profile",
        search: "auth=required&redirect=%2Fprofile",
        serverSessionSync: {
          error: null,
          status: "ready",
          uid: "user-1",
        },
        user: { isAnonymous: false, uid: "user-1" },
      }),
    ).toEqual({
      clearUrl: "/",
      redirectTarget: "/profile",
      type: "redirect",
    })
  })

  it("surfaces the shared sync failure once it is known", () => {
    expect(
      resolveAuthRequiredRecoveryAction({
        authRequired: true,
        loading: false,
        pathname: "/",
        redirectPath: "/profile",
        search: "auth=required&redirect=%2Fprofile",
        serverSessionSync: {
          error: "Authentication service temporarily unavailable",
          status: "error",
          uid: "user-1",
        },
        user: { isAnonymous: false, uid: "user-1" },
      }),
    ).toEqual({
      clearUrl: "/",
      errorMessage: "Authentication service temporarily unavailable",
      redirectTarget: "/profile",
      type: "report-error",
    })
  })

  it("clears the dead-end auth query params while preserving unrelated query state", () => {
    expect(
      stripAuthRedirectParams("/", "auth=required&redirect=%2Fprofile&foo=bar"),
    ).toBe("/?foo=bar")
  })

  it("rejects invalid redirect targets and falls back to home", () => {
    expect(sanitizeAuthRedirectPath("https://evil.example/profile")).toBeNull()
    expect(sanitizeAuthRedirectPath("//evil.example/profile")).toBeNull()
    expect(sanitizeAuthRedirectPath("/profile?tab=settings")).toBe(
      "/profile?tab=settings",
    )
  })
})

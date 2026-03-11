import { describe, expect, it, vi } from "vitest"

const { signInWithPopupMock } = vi.hoisted(() => ({
  signInWithPopupMock: vi.fn(),
}))

vi.mock("@/lib/firebase/config", () => ({
  getFirebaseAuth: vi.fn(() => {
    const error = new Error(
      "Firebase client configuration is missing: NEXT_PUBLIC_FIREBASE_API_KEY.",
    ) as Error & { code: string }
    error.code = "firebase/client-config-missing"
    throw error
  }),
  getFirebaseClientConfigErrorMessage: vi.fn(
    () =>
      "Firebase client configuration is missing: NEXT_PUBLIC_FIREBASE_API_KEY.",
  ),
  isFirebaseClientConfigError: vi.fn(
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "firebase/client-config-missing",
  ),
}))

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: vi.fn(function MockGoogleAuthProvider() {}),
  signInWithPopup: signInWithPopupMock,
}))

import { signInWithGoogle } from "../lib/firebase/auth"

describe("signInWithGoogle", () => {
  it("returns a controlled error when Firebase client config is missing", async () => {
    await expect(signInWithGoogle()).resolves.toEqual({
      success: false,
      error:
        "Firebase client configuration is missing: NEXT_PUBLIC_FIREBASE_API_KEY.",
    })
    expect(signInWithPopupMock).not.toHaveBeenCalled()
  })
})

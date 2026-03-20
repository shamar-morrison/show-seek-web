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

import {
  getCreateAccountErrorMessage,
  shouldOfferEmailAccountCreation,
  signInWithGoogle,
} from "../lib/firebase/auth"

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

describe("shouldOfferEmailAccountCreation", () => {
  it("returns true for missing-account and invalid-credential errors", () => {
    expect(shouldOfferEmailAccountCreation("auth/user-not-found")).toBe(true)
    expect(shouldOfferEmailAccountCreation("auth/invalid-credential")).toBe(
      true,
    )
  })

  it("returns false for other auth errors", () => {
    expect(shouldOfferEmailAccountCreation("auth/wrong-password")).toBe(false)
    expect(shouldOfferEmailAccountCreation(undefined)).toBe(false)
  })
})

describe("getCreateAccountErrorMessage", () => {
  it("maps common create-account failures to user-friendly messages", () => {
    expect(
      getCreateAccountErrorMessage({ code: "auth/email-already-in-use" }),
    ).toBe(
      "An account with this email already exists. Try signing in again or use the original sign-in method.",
    )
    expect(
      getCreateAccountErrorMessage({ code: "auth/weak-password" }),
    ).toBe("Password must be at least 6 characters.")
    expect(
      getCreateAccountErrorMessage({ code: "auth/network-request-failed" }),
    ).toBe("Network error. Please check your internet connection.")
  })
})

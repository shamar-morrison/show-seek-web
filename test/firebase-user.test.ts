import type { User } from "firebase/auth"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  db: {},
  doc: vi.fn((_db, ...segments: string[]) => ({
    path: segments.join("/"),
  })),
  getDoc: vi.fn(),
  serverTimestamp: vi.fn(() => "server-timestamp"),
  setDoc: vi.fn(async () => {}),
}))

vi.mock("@/lib/firebase/config", () => ({
  getFirebaseDb: vi.fn(() => mocks.db),
}))

vi.mock("firebase/firestore", () => ({
  doc: mocks.doc,
  getDoc: mocks.getDoc,
  serverTimestamp: mocks.serverTimestamp,
  setDoc: mocks.setDoc,
}))

import { createUserDocument } from "../lib/firebase/user"

const authenticatedUser = {
  displayName: "User One",
  email: "user@example.com",
  isAnonymous: false,
  photoURL: "https://example.com/avatar.png",
  uid: "user-1",
} as User

describe("createUserDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "warn").mockImplementation(() => {})
  })

  it("repairs malformed existing user documents with a merge write", async () => {
    mocks.getDoc.mockResolvedValue({
      data: () => ({
        createdAt: 1234,
        preferences: { showOriginalTitles: true },
        premium: { isPremium: true },
      }),
      exists: () => true,
    })

    await expect(createUserDocument(authenticatedUser)).resolves.toBe(true)

    expect(mocks.setDoc).toHaveBeenCalledWith(
      { path: "users/user-1" },
      {
        uid: "user-1",
        displayName: "User One",
        email: "user@example.com",
        photoURL: "https://example.com/avatar.png",
      },
      { merge: true },
    )
  })

  it("returns true without writing when an existing document already matches", async () => {
    mocks.getDoc.mockResolvedValue({
      data: () => ({
        displayName: "User One",
        email: "user@example.com",
        photoURL: "https://example.com/avatar.png",
        premium: { isPremium: true },
        uid: "user-1",
      }),
      exists: () => true,
    })

    await expect(createUserDocument(authenticatedUser)).resolves.toBe(true)

    expect(mocks.setDoc).not.toHaveBeenCalled()
  })

  it("returns false when Firestore access fails", async () => {
    mocks.getDoc.mockRejectedValue(new Error("firestore unavailable"))

    await expect(createUserDocument(authenticatedUser)).resolves.toBe(false)

    expect(console.warn).toHaveBeenCalledWith(
      "Failed to create/update user document:",
      expect.any(Error),
    )
  })

  it("returns false for anonymous users without touching Firestore", async () => {
    await expect(
      createUserDocument({
        ...authenticatedUser,
        isAnonymous: true,
      } as User),
    ).resolves.toBe(false)

    expect(mocks.getDoc).not.toHaveBeenCalled()
    expect(mocks.setDoc).not.toHaveBeenCalled()
  })
})

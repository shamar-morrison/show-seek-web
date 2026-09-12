import { episodeTrackingService } from "@/services/episode-tracking-service"
import { doc, updateDoc } from "firebase/firestore"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuth = vi.hoisted(() => ({
  currentUser: { uid: "user-1" } as { uid: string } | null,
}))

vi.mock("@/lib/firebase/config", () => ({
  getFirebaseAuth: vi.fn(() => mockAuth),
  getFirebaseDb: vi.fn(() => ({})),
}))

vi.mock("firebase/firestore", () => ({
  deleteDoc: vi.fn(),
  deleteField: vi.fn(),
  doc: vi.fn((_db, ...pathSegments) => ({
    path: pathSegments.join("/"),
  })),
  getDoc: vi.fn(),
  setDoc: vi.fn(async () => {}),
  updateDoc: vi.fn(async () => {}),
}))

describe("episodeTrackingService.setHiddenFromProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.currentUser = { uid: "user-1" }
    vi.mocked(updateDoc).mockResolvedValue(undefined as never)
  })

  it("updates metadata.hiddenFromProgress to true without touching lastUpdated or episodes", async () => {
    await episodeTrackingService.setHiddenFromProgress(1399, true)

    expect(doc).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "user-1",
      "episode_tracking",
      "1399",
    )

    expect(updateDoc).toHaveBeenCalledTimes(1)
    const [ref, updates] = vi.mocked(updateDoc).mock.calls[0]
    expect(ref).toEqual({ path: "users/user-1/episode_tracking/1399" })
    expect(updates).toEqual({
      "metadata.hiddenFromProgress": true,
    })
    expect(updates).not.toHaveProperty("metadata.lastUpdated")
    expect(updates).not.toHaveProperty("episodes")
    expect(updates).not.toHaveProperty("lastUpdated")
  })

  it("updates metadata.hiddenFromProgress to false when unhiding", async () => {
    await episodeTrackingService.setHiddenFromProgress(1399, false)

    expect(updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: "users/user-1/episode_tracking/1399" }),
      {
        "metadata.hiddenFromProgress": false,
      },
    )
  })

  it("throws an error when user is not authenticated", async () => {
    mockAuth.currentUser = null

    await expect(
      episodeTrackingService.setHiddenFromProgress(1399, true),
    ).rejects.toThrow("Please sign in to continue")

    expect(updateDoc).not.toHaveBeenCalled()
  })

  it("wraps and propagates Firestore update errors", async () => {
    vi.mocked(updateDoc).mockRejectedValueOnce(new Error("Firestore write failed"))

    await expect(
      episodeTrackingService.setHiddenFromProgress(1399, true),
    ).rejects.toThrow("Firestore write failed")
  })
})

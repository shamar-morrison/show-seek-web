import { exportToCSV, exportToMarkdown } from "@/lib/export-data"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  blob: null as Blob | null,
  click: vi.fn(),
  getDocs: vi.fn(),
}))

vi.mock("@/lib/firebase/config", () => ({
  getFirebaseDb: vi.fn(() => ({})),
}))

vi.mock("@/lib/tmdb", () => ({
  getMovieDetails: vi.fn(),
  getTVDetails: vi.fn(),
}))

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db, ...segments: string[]) => ({
    path: segments.join("/"),
  })),
  getDocs: (...args: unknown[]) => mocks.getDocs(...args),
}))

describe("export-data", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    mocks.blob = null

    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName)
      if (tagName === "a") {
        element.click = mocks.click
      }
      return element
    })

    vi.spyOn(URL, "createObjectURL").mockImplementation((object) => {
      if (object instanceof Blob) {
        mocks.blob = object
      }
      return "blob:test"
    })
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})

    mocks.getDocs.mockImplementation(async (ref: { path: string }) => {
      if (ref.path === "users/user-1/lists") {
        return { docs: [] }
      }

      if (ref.path === "users/user-1/favorite_persons") {
        return { docs: [] }
      }

      if (ref.path === "users/user-1/ratings") {
        return {
          docs: [
            {
              id: "season-777-2",
              data: () => ({
                id: "season-777-2",
                mediaType: "season",
                rating: 8.5,
                title: "Season 2",
                tvShowId: 777,
                seasonNumber: 2,
                tvShowName: "Signal Run",
                ratedAt: 123,
              }),
            },
            {
              id: "season-broken",
              data: () => ({
                mediaType: "season",
                rating: 6,
                tvShowId: 888,
                tvShowName: "Broken Season Show",
                ratedAt: 456,
              }),
            },
            {
              id: "episode-broken",
              data: () => ({
                mediaType: "episode",
                rating: 7,
                tvShowId: 999,
                tvShowName: "Broken Episode Show",
                episodeName: "Missing Numbers",
                ratedAt: 789,
              }),
            },
          ],
        }
      }

      return { docs: [] }
    })
  })

  it("includes season ratings in markdown exports", async () => {
    await exportToMarkdown("user-1")

    const content = await mocks.blob?.text()

    expect(content).toContain("### Seasons")
    expect(content).toContain("**Signal Run - Season 2**: 8.5/10")
    expect(content).not.toContain("Broken Season Show")
    expect(content).not.toContain("Broken Episode Show")
  })

  it("includes season ratings in csv exports", async () => {
    await exportToCSV("user-1")

    const content = await mocks.blob?.text()

    expect(content).toContain("Category,Title,Type,Rating")
    expect(content).toContain("Rating,Signal Run - Season 2,Season,8.5")
    expect(content).not.toContain("Broken Season Show")
    expect(content).not.toContain("Broken Episode Show")
  })
})

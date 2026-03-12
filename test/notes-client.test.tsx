import { NotesClient } from "@/app/lists/notes/notes-client"
import { render, screen } from "@/test/utils"
import userEvent from "@testing-library/user-event"
import { Timestamp } from "firebase/firestore"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  removeNote: vi.fn(),
  notes: new Map(),
  preferences: {
    showOriginalTitles: true,
  },
  lastModalProps: null as {
    media: {
      original_title?: string
      original_name?: string
    }
  } | null,
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { uid: "user-1" },
    loading: false,
  }),
}))

vi.mock("@/hooks/use-notes", () => ({
  useNotes: () => ({
    notes: mocks.notes,
    loading: false,
    removeNote: mocks.removeNote,
  }),
}))

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: () => ({
    preferences: mocks.preferences,
  }),
}))

vi.mock("@/components/notes-modal", () => ({
  NotesModal: (props: {
    isOpen: boolean
    media: {
      original_title?: string
      original_name?: string
    }
  }) => {
    mocks.lastModalProps = props
    return props.isOpen ? (
      <div
        data-testid="notes-modal"
        data-original-title={
          props.media.original_title ?? props.media.original_name ?? ""
        }
      />
    ) : null
  },
}))

describe("NotesClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.lastModalProps = null
    mocks.notes = new Map([
      [
        "movie-123",
        {
          userId: "user-1",
          mediaId: 123,
          mediaType: "movie",
          content: "Masterpiece",
          mediaTitle: "Spirited Away",
          originalTitle: "Sen to Chihiro no Kamikakushi",
          posterPath: null,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
      ],
    ])
  })

  it("renders the preferred title, searches original titles, and rehydrates modal media", async () => {
    const user = userEvent.setup()

    render(<NotesClient />)

    expect(screen.getByText("Sen to Chihiro no Kamikakushi")).toBeInTheDocument()

    await user.type(
      screen.getByPlaceholderText("Search by title or note content..."),
      "Chihiro",
    )

    expect(screen.getByText("Sen to Chihiro no Kamikakushi")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Edit note" }))

    expect(screen.getByTestId("notes-modal")).toHaveAttribute(
      "data-original-title",
      "Sen to Chihiro no Kamikakushi",
    )
    expect(mocks.lastModalProps?.media.original_title).toBe(
      "Sen to Chihiro no Kamikakushi",
    )
  })
})

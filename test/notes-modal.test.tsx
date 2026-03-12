import { NotesModal } from "@/components/notes-modal"
import { render, screen, waitFor } from "@/test/utils"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getNote: vi.fn(),
  removeNote: vi.fn(),
  saveNote: vi.fn(),
  preferences: {
    showOriginalTitles: false,
  },
}))

vi.mock("@/hooks/use-notes", () => ({
  useNotes: () => ({
    getNote: mocks.getNote,
    saveNote: mocks.saveNote,
    removeNote: mocks.removeNote,
  }),
}))

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: () => ({
    preferences: mocks.preferences,
  }),
}))

vi.mock("@/components/ui/base-media-modal", () => ({
  BaseMediaModal: ({
    children,
    title,
    description,
  }: {
    children: React.ReactNode
    title: string
    description?: string
  }) => (
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      {children}
    </div>
  ),
}))

describe("NotesModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getNote.mockReturnValue(null)
    mocks.saveNote.mockResolvedValue(undefined)
  })

  it("saves canonical and original titles together", async () => {
    const user = userEvent.setup()

    render(
      <NotesModal
        isOpen
        onClose={vi.fn()}
        media={{
          id: 123,
          poster_path: null,
          title: "Spirited Away",
          original_title: "Sen to Chihiro no Kamikakushi",
        }}
        mediaType="movie"
      />,
    )

    await user.type(
      screen.getByPlaceholderText(
        "Write your thoughts, opinions, or reminders about this title...",
      ),
      "Masterpiece",
    )
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(mocks.saveNote).toHaveBeenCalledWith(
        "movie",
        123,
        "Masterpiece",
        "Spirited Away",
        "Sen to Chihiro no Kamikakushi",
        null,
      )
    })
  })
})

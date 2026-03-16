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
  toastSuccess: vi.fn(),
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

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
    error: vi.fn(),
  },
}))

describe("NotesModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getNote.mockReturnValue(null)
    mocks.saveNote.mockResolvedValue(undefined)
    mocks.removeNote.mockResolvedValue(undefined)
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
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Note saved",
      expect.objectContaining({
        action: expect.objectContaining({
          label: "Undo",
          onClick: expect.any(Function),
        }),
      }),
    )
  })

  it("loads and saves episode notes with season, episode, and show metadata", async () => {
    const user = userEvent.setup()

    render(
      <NotesModal
        isOpen
        onClose={vi.fn()}
        media={{
          id: 456,
          show_id: 456,
          season_number: 1,
          episode_number: 2,
          poster_path: null,
          title: "Half Loop",
        }}
        mediaType="episode"
      />,
    )

    expect(mocks.getNote).toHaveBeenCalledWith("episode", 456, 1, 2)

    await user.type(
      screen.getByPlaceholderText(
        "Write your thoughts, opinions, or reminders about this title...",
      ),
      "Excellent episode",
    )
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(mocks.saveNote).toHaveBeenCalledWith(
        "episode",
        456,
        "Excellent episode",
        "Half Loop",
        undefined,
        null,
        1,
        2,
        456,
      )
    })
  })

  it("clears episode notes using season and episode metadata", async () => {
    const user = userEvent.setup()

    mocks.getNote.mockReturnValue({ content: "Existing note" })

    render(
      <NotesModal
        isOpen
        onClose={vi.fn()}
        media={{
          id: 456,
          show_id: 456,
          season_number: 1,
          episode_number: 2,
          poster_path: null,
          title: "Half Loop",
        }}
        mediaType="episode"
      />,
    )

    await user.click(screen.getByRole("button", { name: "Clear" }))

    await waitFor(() => {
      expect(mocks.removeNote).toHaveBeenCalledWith("episode", 456, 1, 2)
    })
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Note cleared",
      expect.objectContaining({
        action: expect.objectContaining({
          label: "Undo",
          onClick: expect.any(Function),
        }),
      }),
    )
  })

  it("restores a cleared note from the success toast action", async () => {
    const user = userEvent.setup()

    mocks.getNote.mockReturnValue({ content: "Existing note" })

    render(
      <NotesModal
        isOpen
        onClose={vi.fn()}
        media={{
          id: 456,
          show_id: 456,
          season_number: 1,
          episode_number: 2,
          poster_path: null,
          title: "Half Loop",
        }}
        mediaType="episode"
      />,
    )

    await user.click(screen.getByRole("button", { name: "Clear" }))

    const toastOptions = mocks.toastSuccess.mock.calls[0]?.[1] as
      | { action?: { onClick: () => void } }
      | undefined

    await toastOptions?.action?.onClick()

    expect(mocks.saveNote).toHaveBeenCalledWith(
      "episode",
      456,
      "Existing note",
      "Half Loop",
      undefined,
      null,
      1,
      2,
      456,
    )
  })
})

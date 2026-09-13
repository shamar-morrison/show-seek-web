import { NotesModal } from "@/components/notes-modal"
import { render, screen, waitFor } from "@/test/utils"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  getNote: vi.fn(),
  premiumStatus: "free",
  removeNote: vi.fn(),
  saveNote: vi.fn(),
  preferences: {
    showOriginalTitles: false,
  },
  toastSuccess: vi.fn(),
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    premiumStatus: mocks.premiumStatus,
  }),
}))

vi.mock("@/components/premium-modal", () => ({
  PremiumModal: ({
    open,
    title,
    description,
  }: {
    open: boolean
    title?: string
    description?: string
  }) =>
    open ? (
      <div data-testid="premium-modal">
        <span>{title}</span>
        <span>{description}</span>
      </div>
    ) : null,
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
    mocks.premiumStatus = "free"
    mocks.getNote.mockReturnValue(null)
    mocks.saveNote.mockResolvedValue(undefined)
    mocks.removeNote.mockResolvedValue(undefined)
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ canCreate: true, currentCount: 3, limit: 15 }),
    })
    vi.stubGlobal("fetch", mocks.fetch)
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

  it("loads and saves season notes with season and show metadata", async () => {
    const user = userEvent.setup()

    render(
      <NotesModal
        isOpen
        onClose={vi.fn()}
        media={{
          id: 456,
          show_id: 456,
          season_number: 2,
          poster_path: "/s2.jpg",
          name: "Show - Season 2",
        }}
        mediaType="season"
      />,
    )

    expect(mocks.getNote).toHaveBeenCalledWith("season", 456, 2, undefined)

    await user.type(
      screen.getByPlaceholderText(
        "Write your thoughts, opinions, or reminders about this title...",
      ),
      "Great season",
    )
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(mocks.saveNote).toHaveBeenCalledWith(
        "season",
        456,
        "Great season",
        "Show - Season 2",
        undefined,
        "/s2.jpg",
        2,
        undefined,
        456,
      )
    })
  })

  it("clears season notes using season metadata", async () => {
    const user = userEvent.setup()

    mocks.getNote.mockReturnValue({ content: "Existing note" })

    render(
      <NotesModal
        isOpen
        onClose={vi.fn()}
        media={{
          id: 456,
          show_id: 456,
          season_number: 2,
          poster_path: "/s2.jpg",
          name: "Show - Season 2",
        }}
        mediaType="season"
      />,
    )

    await user.click(screen.getByRole("button", { name: "Clear" }))

    await waitFor(() => {
      expect(mocks.removeNote).toHaveBeenCalledWith("season", 456, 2, undefined)
    })
  })

  it("accepts up to 200 characters and prevents longer notes", async () => {
    const user = userEvent.setup()

    render(
      <NotesModal
        isOpen
        onClose={vi.fn()}
        media={{
          id: 123,
          poster_path: null,
          title: "Spirited Away",
        }}
        mediaType="movie"
      />,
    )

    const textarea = screen.getByPlaceholderText(
      "Write your thoughts, opinions, or reminders about this title...",
    )
    const withinLimit = "a".repeat(200)
    const overLimit = `${withinLimit}b`

    await user.type(textarea, overLimit)

    expect(textarea).toHaveValue(withinLimit)
    expect(textarea).toHaveAttribute("maxlength", "200")
    expect(screen.getByText("200/200")).toBeInTheDocument()
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

  it("blocks new notes at the limit with the premium upsell", async () => {
    const onClose = vi.fn()
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ canCreate: false, currentCount: 15, limit: 15 }),
    })

    render(
      <NotesModal
        isOpen
        onClose={onClose}
        media={{ id: 123, poster_path: null, title: "Spirited Away" }}
        mediaType="movie"
      />,
    )

    await waitFor(() => {
      expect(mocks.fetch).toHaveBeenCalledWith("/api/notes/can-create")
    })
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })

    const premiumModal = screen.getByTestId("premium-modal")
    expect(premiumModal).toHaveTextContent("Note Limit Reached")
    expect(premiumModal).toHaveTextContent(
      "You've reached the limit of 15 notes. Upgrade to Premium for unlimited notes!",
    )
  })

  it("skips the limit check when editing an existing note", async () => {
    mocks.getNote.mockReturnValue({ content: "Existing note" })

    render(
      <NotesModal
        isOpen
        onClose={vi.fn()}
        media={{ id: 123, poster_path: null, title: "Spirited Away" }}
        mediaType="movie"
      />,
    )

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument()
    })
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(screen.queryByTestId("premium-modal")).not.toBeInTheDocument()
  })

  it("skips the limit check for premium users", async () => {
    mocks.premiumStatus = "premium"

    render(
      <NotesModal
        isOpen
        onClose={vi.fn()}
        media={{ id: 123, poster_path: null, title: "Spirited Away" }}
        mediaType="movie"
      />,
    )

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(
          "Write your thoughts, opinions, or reminders about this title...",
        ),
      ).toBeInTheDocument()
    })
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(screen.queryByTestId("premium-modal")).not.toBeInTheDocument()
  })
})

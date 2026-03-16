import { MarkAsWatchedModal } from "@/components/mark-as-watched-modal"
import { render, screen, waitFor } from "@/test/utils"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

const originalTimeZone = process.env.TZ

function restoreTimeZone() {
  if (originalTimeZone === undefined) {
    delete process.env.TZ
    return
  }

  process.env.TZ = originalTimeZone
}

vi.mock("@/components/ui/base-media-modal", () => ({
  BaseMediaModal: ({
    children,
    description,
    isOpen,
    title,
  }: {
    children?: ReactNode
    description?: string
    isOpen: boolean
    title: string
  }) =>
    isOpen ? (
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
        {children}
      </div>
    ) : null,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    disabled,
    onClick,
  }: {
    children?: ReactNode
    disabled?: boolean
    onClick?: () => void
  }) => (
    <button disabled={disabled} onClick={onClick} type="button">
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/calendar", () => ({
  Calendar: () => null,
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({
    children,
    disabled,
    onClick,
  }: {
    children?: ReactNode
    disabled?: boolean
    onClick?: () => void
  }) => (
    <button disabled={disabled} onClick={onClick} type="button">
      {children}
    </button>
  ),
  AlertDialogCancel: ({
    children,
    disabled,
  }: {
    children?: ReactNode
    disabled?: boolean
  }) => (
    <button disabled={disabled} type="button">
      {children}
    </button>
  ),
  AlertDialogContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogDescription: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogFooter: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

afterEach(() => {
  restoreTimeZone()
})

describe("MarkAsWatchedModal", () => {
  it("uses the TMDB release date as the local calendar day", async () => {
    process.env.TZ = "America/Jamaica"

    const user = userEvent.setup()
    const onMarkAsWatched = vi.fn().mockResolvedValue(undefined)

    render(
      <MarkAsWatchedModal
        isOpen
        onClose={vi.fn()}
        movieTitle="Example Movie"
        releaseDate="2024-03-27"
        watchCount={0}
        onMarkAsWatched={onMarkAsWatched}
        onClearAll={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    const releaseDateButton = screen.getByRole("button", {
      name: "Release Date (Mar 27, 2024)",
    })

    await user.click(releaseDateButton)

    await waitFor(() => {
      expect(onMarkAsWatched).toHaveBeenCalledTimes(1)
    })

    const watchedDate = onMarkAsWatched.mock.calls[0][0] as Date
    expect(watchedDate.getFullYear()).toBe(2024)
    expect(watchedDate.getMonth()).toBe(2)
    expect(watchedDate.getDate()).toBe(27)
  })
})

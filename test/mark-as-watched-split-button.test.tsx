import { MarkAsWatchedSplitButton } from "@/components/mark-as-watched-split-button"
import { render, screen, waitFor } from "@/test/utils"
import userEvent from "@testing-library/user-event"
import type {
  ComponentProps,
  Dispatch,
  MouseEvent,
  ReactElement,
  ReactNode,
  SetStateAction,
} from "react"
import { cloneElement, createContext, useContext, useState } from "react"
import { describe, expect, it, vi } from "vitest"

const DropdownMenuContext = createContext<{
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
} | null>(null)

vi.mock("@/components/ui/button", () => ({
  Button: ({
    "aria-label": ariaLabel,
    children,
    className,
    disabled,
    onClick,
    type,
  }: ComponentProps<"button">) => (
    <button
      aria-label={ariaLabel}
      className={className}
      disabled={disabled}
      onClick={onClick}
      type={type ?? "button"}
    >
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children?: ReactNode }) => {
    const [open, setOpen] = useState(false)

    return (
      <DropdownMenuContext.Provider value={{ open, setOpen }}>
        {children}
      </DropdownMenuContext.Provider>
    )
  },
  DropdownMenuTrigger: ({ render }: { render: ReactElement }) => {
    const context = useContext(DropdownMenuContext)
    const triggerElement = render as ReactElement<ComponentProps<"button">>

    if (!context) {
      return triggerElement
    }

    const existingOnClick = triggerElement.props.onClick as
      | ((event: MouseEvent) => void)
      | undefined

    return cloneElement(triggerElement, {
      onClick: (event: MouseEvent) => {
        existingOnClick?.(event)
        context.setOpen((current) => !current)
      },
    })
  },
  DropdownMenuContent: ({ children }: { children?: ReactNode }) => {
    const context = useContext(DropdownMenuContext)
    return context?.open ? <div>{children}</div> : null
  },
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children?: ReactNode
    onClick?: () => void
  }) => {
    const context = useContext(DropdownMenuContext)

    return (
      <button
        onClick={() => {
          onClick?.()
          context?.setOpen(false)
        }}
        type="button"
      >
        {children}
      </button>
    )
  },
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
    open,
  }: {
    children?: ReactNode
    open?: boolean
  }) => (open === false ? null : <div>{children}</div>),
  DialogContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogFooter: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({
    children,
    open,
  }: {
    children?: ReactNode
    open?: boolean
  }) => (open === false ? null : <div>{children}</div>),
  AlertDialogAction: ({
    children,
    disabled,
    onClick,
  }: ComponentProps<"button">) => (
    <button disabled={disabled} onClick={onClick} type="button">
      {children}
    </button>
  ),
  AlertDialogCancel: ({
    children,
    disabled,
  }: ComponentProps<"button">) => (
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

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({
    onSelect,
  }: {
    onSelect?: (date: Date) => void
  }) => (
    <button
      onClick={() => onSelect?.(new Date("2024-03-25T00:00:00.000Z"))}
      type="button"
    >
      Select Mar 25, 2024
    </button>
  ),
}))

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

describe("MarkAsWatchedSplitButton", () => {
  it("hides the history dropdown trigger when there is no watch history", () => {
    render(
      <MarkAsWatchedSplitButton
        movieTitle="Example Movie"
        watchCount={0}
        instances={[]}
        onMarkAsWatched={vi.fn()}
        onClearWatchHistory={vi.fn().mockResolvedValue(undefined)}
        onDeleteWatch={vi.fn().mockResolvedValue(undefined)}
        onUpdateWatch={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(
      screen.queryByRole("button", { name: "Watch history actions" }),
    ).not.toBeInTheDocument()
  })

  it("calls the primary watched action when the main button is clicked", async () => {
    const user = userEvent.setup()
    const onMarkAsWatched = vi.fn()

    render(
      <MarkAsWatchedSplitButton
        movieTitle="Example Movie"
        watchCount={1}
        instances={[
          {
            id: "watch-a",
            movieId: 101,
            watchedAt: new Date("2026-03-09T19:00:00.000Z"),
          },
        ]}
        onMarkAsWatched={onMarkAsWatched}
        onClearWatchHistory={vi.fn().mockResolvedValue(undefined)}
        onDeleteWatch={vi.fn().mockResolvedValue(undefined)}
        onUpdateWatch={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Watched 1 time" }))

    expect(onMarkAsWatched).toHaveBeenCalledTimes(1)
  })

  it("opens watch history from the dropdown and supports editing and deleting entries", async () => {
    const user = userEvent.setup()
    const onDeleteWatch = vi.fn().mockResolvedValue(undefined)
    const onUpdateWatch = vi.fn().mockResolvedValue(undefined)

    render(
      <MarkAsWatchedSplitButton
        movieTitle="Example Movie"
        watchCount={2}
        instances={[
          {
            id: "watch-a",
            movieId: 101,
            watchedAt: new Date("2026-03-09T19:00:00.000Z"),
          },
          {
            id: "watch-b",
            movieId: 101,
            watchedAt: new Date("2026-03-08T19:00:00.000Z"),
          },
        ]}
        onMarkAsWatched={vi.fn()}
        onClearWatchHistory={vi.fn().mockResolvedValue(undefined)}
        onDeleteWatch={onDeleteWatch}
        onUpdateWatch={onUpdateWatch}
      />,
    )

    await user.click(
      screen.getByRole("button", { name: "Watch history actions" }),
    )
    await user.click(screen.getByRole("button", { name: "View watch history" }))

    expect(screen.getByText("Watch history")).toBeInTheDocument()
    expect(screen.getByText("2nd watch")).toBeInTheDocument()
    expect(screen.getByText("1st watch")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Edit 1st watch" }))
    await user.click(screen.getByRole("button", { name: "Select Mar 25, 2024" }))
    await user.click(screen.getByRole("button", { name: "Save date" }))

    await waitFor(() => {
      expect(onUpdateWatch).toHaveBeenCalledWith(
        "watch-b",
        new Date("2024-03-25T00:00:00.000Z"),
      )
    })

    await user.click(screen.getByRole("button", { name: "Delete 2nd watch" }))
    await user.click(screen.getByRole("button", { name: "Delete watch" }))

    await waitFor(() => {
      expect(onDeleteWatch).toHaveBeenCalledWith("watch-a")
    })
  })

  it("opens clear confirmation from the dropdown and clears history", async () => {
    const user = userEvent.setup()
    const onClearWatchHistory = vi.fn().mockResolvedValue(undefined)

    render(
      <MarkAsWatchedSplitButton
        movieTitle="Example Movie"
        watchCount={1}
        instances={[
          {
            id: "watch-a",
            movieId: 101,
            watchedAt: new Date("2026-03-09T19:00:00.000Z"),
          },
        ]}
        onMarkAsWatched={vi.fn()}
        onClearWatchHistory={onClearWatchHistory}
        onDeleteWatch={vi.fn().mockResolvedValue(undefined)}
        onUpdateWatch={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    await user.click(
      screen.getByRole("button", { name: "Watch history actions" }),
    )
    await user.click(screen.getByRole("button", { name: "Clear watch history" }))

    await user.click(screen.getByRole("button", { name: "Clear watch history" }))

    await waitFor(() => {
      expect(onClearWatchHistory).toHaveBeenCalledTimes(1)
    })
  })
})

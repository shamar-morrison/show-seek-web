import React, { type ComponentProps, type ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { render, screen } from "./utils"

let mockUser: { isAnonymous?: boolean } | null = { isAnonymous: false }
let mockAuthLoading = false
const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }))

vi.mock("@/components/auth-modal", () => ({
  AuthModal: ({ isOpen, message }: { isOpen?: boolean; message?: string }) =>
    isOpen ? <div>auth-modal {message}</div> : null,
}))

vi.mock("@/components/search-dropdown", () => ({
  SearchDropdown: () => <div>search-dropdown</div>,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
  }: {
    children?: ReactNode
    onClick?: () => void
  }) => (
    <button onClick={onClick} type="button">
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/input", () => ({
  Input: (props: ComponentProps<"input">) => <input {...props} />,
}))

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => <div>skeleton</div>,
}))

vi.mock("@/components/user-menu", () => ({
  UserMenu: () => <div>user-menu</div>,
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: mockUser,
    loading: mockAuthLoading,
  }),
}))

vi.mock("@/lib/constants", () => ({
  SHOWSEEK_ICON: {},
}))

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <svg />,
}))

vi.mock("@base-ui/react/collapsible", () => ({
  Collapsible: {
    Root: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Trigger: ({
      children,
      ...props
    }: ComponentProps<"button"> & { children?: ReactNode }) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    Panel: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  },
}))

vi.mock("@base-ui/react/navigation-menu", () => ({
  NavigationMenu: {
    Root: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    List: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Item: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Trigger: ({
      children,
      ...props
    }: ComponentProps<"button"> & { children?: ReactNode }) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    Content: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Icon: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    Portal: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Positioner: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    Popup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Arrow: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Viewport: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Link: ({
      children,
      render,
      href,
      ...props
    }: {
      children?: ReactNode
      render?: React.ReactElement<{ href?: string }>
      href?: string
      closeOnClick?: boolean
      [key: string]: unknown
    }) => {
      const { closeOnClick, ...safeProps } = props
      void closeOnClick

      return render ? (
        React.cloneElement(
          render as React.ReactElement<Record<string, unknown>>,
          {
            href,
            ...(safeProps as Record<string, unknown>),
          },
          children,
        )
      ) : (
        <a href={href} {...(safeProps as ComponentProps<"a">)}>
          {children}
        </a>
      )
    },
  },
}))

vi.mock("nextjs-toploader/app", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

describe("Navbar calendar link", () => {
  beforeEach(() => {
    mockUser = { isAnonymous: false }
    mockAuthLoading = false
    pushMock.mockClear()
  })

  it("shows the calendar link for signed-in users", async () => {
    const { Navbar } = await import("@/components/navbar")

    render(<Navbar />)

    expect(screen.getAllByText("Calendar").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Where to Watch").length).toBeGreaterThan(0)
  })

  it("groups authenticated library destinations under the library menu", async () => {
    const { Navbar } = await import("@/components/navbar")

    render(<Navbar />)

    expect(screen.getAllByText("Library").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Progress").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Lists").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Ratings & Favorites").length).toBeGreaterThan(0)
    expect(screen.getAllByText("My Ratings").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Favorite Episodes").length).toBeGreaterThan(0)
  })

  it("shows all nav links for signed-out users", async () => {
    mockUser = null
    const { Navbar } = await import("@/components/navbar")

    render(<Navbar />)

    expect(screen.getAllByText("Discover").length).toBeGreaterThan(0)
    expect(screen.getAllByText("For You").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Calendar").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Where to Watch").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Library").length).toBeGreaterThan(0)
    expect(screen.getAllByText("My Ratings").length).toBeGreaterThan(0)
  })

  it("opens the sign-in modal when a guest clicks a gated link", async () => {
    mockUser = null
    const { Navbar } = await import("@/components/navbar")
    const { fireEvent } = await import("@testing-library/react")

    render(<Navbar />)

    fireEvent.click(screen.getAllByText("Calendar")[0])

    expect(
      screen.getByText("auth-modal Sign in to view your release calendar"),
    ).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it("navigates directly when a signed-in user clicks a gated link", async () => {
    const { Navbar } = await import("@/components/navbar")
    const { fireEvent } = await import("@testing-library/react")

    render(<Navbar />)

    fireEvent.click(screen.getAllByText("Calendar")[0])

    expect(pushMock).not.toHaveBeenCalled()
    expect(screen.queryByText(/auth-modal/)).not.toBeInTheDocument()
  })

  it("does not open the modal while auth state is still resolving", async () => {
    mockUser = null
    mockAuthLoading = true
    const { Navbar } = await import("@/components/navbar")
    const { fireEvent } = await import("@testing-library/react")

    render(<Navbar />)

    fireEvent.click(screen.getAllByText("Calendar")[0])

    expect(screen.queryByText(/auth-modal/)).not.toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it("clears mobile search input and refocuses when clear button is clicked", async () => {
    const { Navbar } = await import("@/components/navbar")
    const { fireEvent } = await import("@testing-library/react")

    render(<Navbar />)

    const mobileInput = screen.getByPlaceholderText(
      "Search shows, movies, people...",
    )
    expect(
      screen.queryByRole("button", { name: "Clear search" }),
    ).not.toBeInTheDocument()

    fireEvent.change(mobileInput, { target: { value: "Severance" } })

    const clearButton = screen.getByRole("button", { name: "Clear search" })
    expect(clearButton).toBeInTheDocument()

    fireEvent.click(clearButton)

    expect(mobileInput).toHaveValue("")
    expect(
      screen.queryByRole("button", { name: "Clear search" }),
    ).not.toBeInTheDocument()
    expect(document.activeElement).toBe(mobileInput)
  })
})


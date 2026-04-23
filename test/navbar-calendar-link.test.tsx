import React, { type ComponentProps, type ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { render, screen } from "./utils"

let mockUser: { isAnonymous?: boolean } | null = { isAnonymous: false }

vi.mock("@/components/auth-modal", () => ({
  AuthModal: () => <div>auth-modal</div>,
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
    loading: false,
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
      closeOnClick: _closeOnClick,
      ...props
    }: {
      children?: ReactNode
      render?: React.ReactElement<{ href?: string }>
      href?: string
      closeOnClick?: boolean
      [key: string]: unknown
    }) =>
      render ? (
        React.cloneElement(
          render as React.ReactElement<Record<string, unknown>>,
          {
            href,
            ...(props as Record<string, unknown>),
          },
          children,
        )
      ) : (
        <a href={href} {...props}>
          {children}
        </a>
      ),
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

describe("Navbar calendar link", () => {
  beforeEach(() => {
    mockUser = { isAnonymous: false }
  })

  it("shows the calendar link for signed-in users", async () => {
    const { Navbar } = await import("@/components/navbar")

    render(<Navbar />)

    expect(screen.getAllByText("Calendar").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Where to Watch").length).toBeGreaterThan(0)
  })

  it("hides the calendar link for signed-out users", async () => {
    mockUser = null
    const { Navbar } = await import("@/components/navbar")

    render(<Navbar />)

    expect(screen.queryByText("Calendar")).not.toBeInTheDocument()
    expect(screen.queryByText("Where to Watch")).not.toBeInTheDocument()
  })
})

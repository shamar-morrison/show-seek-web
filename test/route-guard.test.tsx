import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "./utils"

const useAuthMock = vi.fn()
const authModalMock = vi.fn(({ message }: { message?: string }) => (
  <div data-testid="auth-modal">{message}</div>
))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock("@/components/auth-modal", () => ({
  AuthModal: (props: { message?: string }) => authModalMock(props),
}))

describe("RouteGuard", () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    authModalMock.mockClear()
  })

  it("shows the inline auth gate for unauthenticated users", async () => {
    useAuthMock.mockReturnValue({
      user: null,
      loading: false,
    })

    const { RouteGuard } = await import("../components/route-guard")
    render(
      <RouteGuard
        message="Manage your preferences and account settings."
        title="Sign in to view your profile"
      >
        <div>Protected profile content</div>
      </RouteGuard>,
    )

    expect(screen.getByText("Sign in to view your profile")).toBeInTheDocument()
    expect(
      screen.getAllByText("Manage your preferences and account settings."),
    ).toHaveLength(2)
    expect(screen.getByTestId("auth-modal")).toHaveTextContent(
      "Manage your preferences and account settings.",
    )
    expect(
      screen.queryByText("Protected profile content"),
    ).not.toBeInTheDocument()
  })

  it("renders protected content for authenticated users", async () => {
    useAuthMock.mockReturnValue({
      user: {
        isAnonymous: false,
        uid: "user-123",
      },
      loading: false,
    })

    const { RouteGuard } = await import("../components/route-guard")
    render(
      <RouteGuard>
        <div>Protected profile content</div>
      </RouteGuard>,
    )

    expect(screen.getByText("Protected profile content")).toBeInTheDocument()
    expect(screen.queryByTestId("auth-modal")).not.toBeInTheDocument()
  })

  it("shows the default spinner while auth state is loading", async () => {
    useAuthMock.mockReturnValue({
      user: null,
      loading: true,
    })

    const { RouteGuard } = await import("../components/route-guard")
    const { container } = render(
      <RouteGuard>
        <div>Protected profile content</div>
      </RouteGuard>,
    )

    expect(container.querySelector(".animate-spin")).toBeInTheDocument()
    expect(
      screen.queryByText("Protected profile content"),
    ).not.toBeInTheDocument()
  })

  it("shows the loading fallback instead of the spinner while auth state is loading", async () => {
    useAuthMock.mockReturnValue({
      user: null,
      loading: true,
    })

    const { RouteGuard } = await import("../components/route-guard")
    const { container } = render(
      <RouteGuard loadingFallback={<div data-testid="custom-skeleton" />}>
        <div>Protected profile content</div>
      </RouteGuard>,
    )

    expect(screen.getByTestId("custom-skeleton")).toBeInTheDocument()
    expect(container.querySelector(".animate-spin")).not.toBeInTheDocument()
    expect(
      screen.queryByText("Protected profile content"),
    ).not.toBeInTheDocument()
  })
})

import { beforeEach, describe, expect, it, vi } from "vitest"
import { collectText, findElementByType } from "./react-tree-helpers"

const useAuthMock = vi.fn()
const authModalMock = vi.fn(() => null)

vi.mock("@/context/auth-context", () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock("@/components/auth-modal", () => ({
  AuthModal: authModalMock,
}))

describe("RouteGuard", () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    authModalMock.mockReset()
    authModalMock.mockImplementation(() => null)
  })

  it("shows the inline auth gate for unauthenticated users", async () => {
    useAuthMock.mockReturnValue({
      user: null,
      loading: false,
    })

    const { RouteGuard } = await import("../components/route-guard")
    const tree = RouteGuard({
      children: <div>Protected profile content</div>,
      message: "Manage your preferences and account settings.",
      title: "Sign in to view your profile",
    })

    expect(collectText(tree)).toEqual(
      expect.arrayContaining([
        "Sign in to view your profile",
        "Manage your preferences and account settings.",
      ]),
    )

    const authModalElement = findElementByType(tree, authModalMock)

    expect(authModalElement).not.toBeNull()
    expect(authModalElement?.props.message).toBe(
      "Manage your preferences and account settings.",
    )
    expect(collectText(tree)).not.toContain("Protected profile content")
  }, 10000)

  it("renders protected content for authenticated users", async () => {
    useAuthMock.mockReturnValue({
      user: {
        isAnonymous: false,
        uid: "user-123",
      },
      loading: false,
    })

    const { RouteGuard } = await import("../components/route-guard")
    const tree = RouteGuard({
      children: <div>Protected profile content</div>,
    })

    expect(collectText(tree)).toContain("Protected profile content")
    expect(findElementByType(tree, authModalMock)).toBeNull()
  }, 10000)
})

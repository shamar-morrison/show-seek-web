import { isValidElement, type ReactElement, type ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const useAuthMock = vi.fn()
const authModalMock = vi.fn(() => null)

vi.mock("@/context/auth-context", () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock("@/components/auth-modal", () => ({
  AuthModal: authModalMock,
}))

function collectText(node: ReactNode): string[] {
  if (typeof node === "string" || typeof node === "number") {
    return [String(node)]
  }

  if (Array.isArray(node)) {
    return node.flatMap(collectText)
  }

  if (isValidElement(node)) {
    return collectText(
      (node as ReactElement<{ children?: ReactNode }>).props.children,
    )
  }

  return []
}

function findElementByType(
  node: ReactNode,
  type: unknown,
): ReactElement<Record<string, unknown>> | null {
  if (!isValidElement(node)) {
    if (Array.isArray(node)) {
      for (const child of node) {
        const match = findElementByType(child, type)
        if (match) {
          return match
        }
      }
    }

    return null
  }

  if (node.type === type) {
    return node as ReactElement<Record<string, unknown>>
  }

  return findElementByType(
    (node as ReactElement<{ children?: ReactNode }>).props.children,
    type,
  )
}

describe("RouteGuard", () => {
  beforeEach(() => {
    useAuthMock.mockReset()
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
    const tree = RouteGuard({
      children: <div>Protected profile content</div>,
    })

    expect(collectText(tree)).toContain("Protected profile content")
    expect(findElementByType(tree, authModalMock)).toBeNull()
  })
})

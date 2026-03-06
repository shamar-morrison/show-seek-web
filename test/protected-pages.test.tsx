import { isValidElement, type ReactElement, type ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

const routeGuardMock = vi.fn(() => null)
const profilePageClientMock = vi.fn(() => null)
const ratingsPageClientMock = vi.fn(() => null)

vi.mock("@/components/route-guard", () => ({
  RouteGuard: routeGuardMock,
}))

vi.mock("../app/profile/profile-page-client", () => ({
  ProfilePageClient: profilePageClientMock,
}))

vi.mock("../app/ratings/ratings-page-client", () => ({
  RatingsPageClient: ratingsPageClientMock,
}))

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

describe("protected pages", () => {
  it("wraps /profile in RouteGuard", async () => {
    const { default: ProfilePage } = await import("../app/profile/page")
    const tree = ProfilePage()
    const routeGuardElement = findElementByType(tree, routeGuardMock)
    const routeGuardProps = routeGuardElement?.props as
      | {
          children?: ReactNode
          message?: string
          title?: string
        }
      | undefined

    expect(routeGuardElement).not.toBeNull()
    expect(routeGuardProps?.title).toBe("Sign in to view your profile")
    expect(routeGuardProps?.message).toBe(
      "Manage your preferences and account settings.",
    )
    expect(
      isValidElement(routeGuardProps?.children) ? routeGuardProps.children.type : null,
    ).toBe(profilePageClientMock)
  })

  it("wraps /ratings in RouteGuard", async () => {
    const { default: RatingsPage } = await import("../app/ratings/page")
    const tree = RatingsPage()
    const routeGuardElement = findElementByType(tree, routeGuardMock)
    const routeGuardProps = routeGuardElement?.props as
      | {
          children?: ReactNode
          message?: string
          title?: string
        }
      | undefined

    expect(routeGuardElement).not.toBeNull()
    expect(routeGuardProps?.title).toBe("Sign in to view your ratings")
    expect(routeGuardProps?.message).toBe(
      "Rate movies and TV shows to track your opinions and see them here.",
    )
    expect(
      isValidElement(routeGuardProps?.children) ? routeGuardProps.children.type : null,
    ).toBe(ratingsPageClientMock)
  })

  it("wraps /lists routes in RouteGuard", async () => {
    const { default: ListsLayout } = await import("../app/lists/layout")
    const tree = ListsLayout({
      children: <div>watch-lists-page</div>,
    })
    const routeGuardElement = findElementByType(tree, routeGuardMock)
    const routeGuardProps = routeGuardElement?.props as
      | {
          children?: ReactNode
          message?: string
          title?: string
        }
      | undefined

    expect(routeGuardElement).not.toBeNull()
    expect(routeGuardProps?.title).toBe("Sign in to view your lists")
    expect(routeGuardProps?.message).toBe(
      "Track your watch progress, create custom lists, and more.",
    )
    expect(collectText(routeGuardProps?.children)).toContain("watch-lists-page")
  })
})

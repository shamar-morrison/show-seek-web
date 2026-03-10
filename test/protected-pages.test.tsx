import { isValidElement, type ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { collectText, findElementByType } from "./react-tree-helpers"

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

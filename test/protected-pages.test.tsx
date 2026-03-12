import { describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import { render, screen } from "./utils"

const routeGuardMock = vi.fn(
  ({
    children,
    message,
    title,
  }: {
    children?: ReactNode
    message?: string
    title?: string
  }) => (
    <section data-testid="route-guard">
      {title ? <h2>{title}</h2> : null}
      {message ? <p>{message}</p> : null}
      <div>{children}</div>
    </section>
  ),
)

vi.mock("@/components/route-guard", () => ({
  RouteGuard: (props: {
    children?: ReactNode
    message?: string
    title?: string
  }) => routeGuardMock(props),
}))

vi.mock("../app/profile/profile-page-client", () => ({
  ProfilePageClient: () => <div>profile-page-client</div>,
}))

vi.mock("@/components/release-calendar-page-client", () => ({
  ReleaseCalendarPageClient: () => <div>release-calendar-page-client</div>,
}))

vi.mock("../app/ratings/ratings-page-client", () => ({
  RatingsPageClient: () => <div>ratings-page-client</div>,
}))

describe("protected pages", () => {
  it("wraps /profile in RouteGuard", async () => {
    const { default: ProfilePage } = await import("../app/profile/page")
    render(<ProfilePage />)

    expect(screen.getByTestId("route-guard")).toBeInTheDocument()
    expect(screen.getByText("Sign in to view your profile")).toBeInTheDocument()
    expect(
      screen.getByText("Manage your preferences and account settings."),
    ).toBeInTheDocument()
    expect(screen.getByText("profile-page-client")).toBeInTheDocument()
  })

  it("wraps /ratings in RouteGuard", async () => {
    const { default: RatingsPage } = await import("../app/ratings/page")
    render(<RatingsPage />)

    expect(
      screen.getByRole("heading", { name: "My Ratings" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Sign in to view your ratings")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Rate movies and TV shows to track your opinions and see them here.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByText("ratings-page-client")).toBeInTheDocument()
  })

  it("wraps /calendar in RouteGuard", async () => {
    const { default: CalendarPage } = await import("../app/calendar/page")
    render(<CalendarPage />)

    expect(screen.getByText("Sign in to view your release calendar")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Track upcoming movies and episodes from your watchlists and favorites.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByText("release-calendar-page-client")).toBeInTheDocument()
  })

  it("wraps /lists routes in RouteGuard", async () => {
    const { default: ListsLayout } = await import("../app/lists/layout")
    render(<ListsLayout>{<div>watch-lists-page</div>}</ListsLayout>)

    expect(screen.getByText("Sign in to view your lists")).toBeInTheDocument()
    expect(
      screen.getByText("Track your watch progress, create custom lists, and more."),
    ).toBeInTheDocument()
    expect(screen.getByText("watch-lists-page")).toBeInTheDocument()
  })
})

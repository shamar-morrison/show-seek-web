import { NextRequest, NextResponse } from "next/server"

// Routes that require authentication
const protectedRoutes = ["/lists", "/profile", "/favorites", "/ratings"]

// Routes that should redirect authenticated users (e.g., login page)
const authRoutes = ["/login", "/signup"]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionCookie = request.cookies.get("session")?.value

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route),
  )

  // Check if route is an auth route
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route))

  // For protected routes, redirect to home if no session
  // We redirect to home instead of /login since auth is via modal
  if (isProtectedRoute && !sessionCookie) {
    const homeUrl = new URL("/", request.url)
    homeUrl.searchParams.set("auth", "required")
    homeUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(homeUrl)
  }

  // For auth routes, redirect to home if already logged in
  if (isAuthRoute && sessionCookie) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (handled separately)
     */
    "/((?!_next/static|_next/image|favicon.ico|public|api).*)",
  ],
}

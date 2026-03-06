import { verifySessionCookieValue } from "@/lib/firebase/server-auth"
import { NextRequest, NextResponse } from "next/server"

// Routes that require authentication
const protectedRoutes = ["/lists", "/profile", "/favorites", "/ratings"]

// Routes that should redirect authenticated users (e.g., login page)
const authRoutes = ["/login", "/signup"]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionCookie = request.cookies.get("session")?.value

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route),
  )

  // Check if route is an auth route
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route))

  // Only validate session if the route actually needs it
  if (isProtectedRoute || isAuthRoute) {
    const isValidSession = sessionCookie
      ? await validateSession(sessionCookie)
      : false

    // For protected routes, redirect to home if no valid session
    // We redirect to home instead of /login since auth is via modal
    if (isProtectedRoute && !isValidSession) {
      const homeUrl = new URL("/", request.url)
      homeUrl.searchParams.set("auth", "required")
      homeUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(homeUrl)
    }

    // For auth routes, redirect to home if already logged in
    if (isAuthRoute && isValidSession) {
      return NextResponse.redirect(new URL("/", request.url))
    }
  }

  return NextResponse.next()
}

/**
 * Validates a session cookie directly in the Worker runtime.
 */
async function validateSession(sessionCookie: string): Promise<boolean> {
  try {
    const decodedClaims = await verifySessionCookieValue(sessionCookie, true)
    return decodedClaims !== null
  } catch {
    // If validation fails for any reason, treat as invalid
    return false
  }
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

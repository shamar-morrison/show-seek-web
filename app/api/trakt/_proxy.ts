import { NextRequest, NextResponse } from "next/server"

const DEFAULT_FUNCTIONS_REGION = "us-central1"

type TraktProxyPath = "/oauth/start" | "/sync" | "/disconnect" | "/enrich"

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "")
}

export function getTraktBackendBaseUrl(): string | null {
  const configuredUrl = process.env.TRAKT_BACKEND_URL?.trim()

  if (configuredUrl) {
    return trimTrailingSlash(configuredUrl)
  }

  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    process.env.FIREBASE_ADMIN_PROJECT_ID?.trim()

  if (!projectId) {
    return null
  }

  const region =
    process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION?.trim() ||
    DEFAULT_FUNCTIONS_REGION

  return `https://${region}-${projectId}.cloudfunctions.net/traktApi`
}

function getBearerAuthorization(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization")?.trim()

  if (!authorization || !/^Bearer\s+\S+/i.test(authorization)) {
    return null
  }

  return authorization
}

function copyResponseHeaders(response: Response): Headers {
  const headers = new Headers()
  const contentType = response.headers.get("content-type")

  if (contentType) {
    headers.set("content-type", contentType)
  }

  headers.set("cache-control", "no-store")
  return headers
}

export async function proxyTraktRequest(
  request: NextRequest,
  path: TraktProxyPath,
): Promise<NextResponse> {
  const authorization = getBearerAuthorization(request)

  if (!authorization) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const backendBaseUrl = getTraktBackendBaseUrl()

  if (!backendBaseUrl) {
    return NextResponse.json(
      { error: "Trakt backend is not configured" },
      { status: 503 },
    )
  }

  const requestHeaders: Record<string, string> = {
    Authorization: authorization,
  }
  let body: string | undefined

  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.text()
    if (body) {
      requestHeaders["Content-Type"] =
        request.headers.get("content-type") ?? "application/json"
    }
  }

  try {
    const backendResponse = await fetch(`${backendBaseUrl}${path}`, {
      method: request.method,
      headers: requestHeaders,
      body,
      cache: "no-store",
    })
    const responseText = await backendResponse.text()

    return new NextResponse(responseText, {
      status: backendResponse.status,
      headers: copyResponseHeaders(backendResponse),
    })
  } catch (error) {
    console.error("Trakt proxy request failed:", error)
    return NextResponse.json(
      { error: "Trakt service temporarily unavailable" },
      { status: 502 },
    )
  }
}

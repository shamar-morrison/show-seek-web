import { adminDb } from "@/lib/firebase/admin"
import { exchangeCodeForToken } from "@/lib/trakt"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const state = searchParams.get("state") // This is the userId
  const error = searchParams.get("error")

  // Handle error from Trakt
  if (error) {
    return new NextResponse(
      generateErrorPage("Authorization was denied or an error occurred."),
      { headers: { "Content-Type": "text/html" } },
    )
  }

  if (!code || !state) {
    return new NextResponse(
      generateErrorPage("Missing authorization code or user ID."),
      { headers: { "Content-Type": "text/html" } },
    )
  }

  if (!adminDb) {
    console.error("Firebase Admin not configured")
    return new NextResponse(generateErrorPage("Server configuration error."), {
      headers: { "Content-Type": "text/html" },
    })
  }

  try {
    // Exchange code for tokens
    const tokenData = await exchangeCodeForToken(code)

    // Calculate expiration timestamp
    const expiresAt = (tokenData.created_at + tokenData.expires_in) * 1000

    // Store tokens in Firestore on the user document (matching mobile app schema)
    await adminDb.doc(`users/${state}`).set(
      {
        traktAccessToken: tokenData.access_token,
        traktRefreshToken: tokenData.refresh_token,
        traktTokenExpiresAt: new Date(expiresAt),
        traktConnectedAt: new Date(),
        traktConnected: true,
      },
      { merge: true },
    )

    // Return success page that notifies the opener and closes itself
    return new NextResponse(generateSuccessPage(), {
      headers: { "Content-Type": "text/html" },
    })
  } catch (error) {
    console.error("Trakt callback error:", error)
    return new NextResponse(
      generateErrorPage("Failed to complete authorization. Please try again."),
      { headers: { "Content-Type": "text/html" } },
    )
  }
}

function generateSuccessPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connected to Trakt</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 1.5rem;
      background: rgba(34, 197, 94, 0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon svg {
      width: 40px;
      height: 40px;
      color: #22c55e;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    p {
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.875rem;
      margin-bottom: 1.5rem;
    }
    button {
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: #fff;
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover {
      background: rgba(255, 255, 255, 0.15);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
    <h1>Connected to Trakt!</h1>
    <p>You can now close this tab and return to Show Seek.</p>
    <button onclick="window.close()">Close this tab</button>
  </div>
  <script>
    // Notify the opener window that connection was successful
    if (window.opener) {
      window.opener.postMessage('trakt-connected', '*');
    }
  </script>
</body>
</html>`
}

function generateErrorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connection Failed</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 1.5rem;
      background: rgba(239, 68, 68, 0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon svg {
      width: 40px;
      height: 40px;
      color: #ef4444;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    p {
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.875rem;
      margin-bottom: 1.5rem;
    }
    button {
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: #fff;
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover {
      background: rgba(255, 255, 255, 0.15);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
    <h1>Connection Failed</h1>
    <p>${message}</p>
    <button onclick="window.close()">Close this tab</button>
  </div>
</body>
</html>`
}

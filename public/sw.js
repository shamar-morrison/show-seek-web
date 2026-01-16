// Minimal service worker for PWA installability
// Does NOT cache any assets - only provides offline detection

const OFFLINE_MESSAGE =
  "No internet connection. Please check your network and try again."

// Install event - skip waiting to activate immediately
self.addEventListener("install", (event) => {
  self.skipWaiting()
})

// Activate event - claim all clients
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

// Fetch event - pass through all requests, return offline message when network fails
self.addEventListener("fetch", (event) => {
  // Only handle navigation requests (HTML pages)
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline - ShowSeek</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #1a1a1a;
      color: #fafafa;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .icon {
      font-size: 4rem;
      margin-bottom: 1.5rem;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
    }
    p {
      color: #a1a1a1;
      font-size: 1rem;
    }
    button {
      margin-top: 1.5rem;
      padding: 0.75rem 1.5rem;
      background: #E50914;
      color: white;
      border: none;
      border-radius: 0.5rem;
      font-size: 1rem;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    button:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📡</div>
    <h1>You're Offline</h1>
    <p>${OFFLINE_MESSAGE}</p>
    <button onclick="window.location.reload()">Try Again</button>
  </div>
</body>
</html>`,
          {
            status: 503,
            statusText: "Service Unavailable",
            headers: { "Content-Type": "text/html; charset=utf-8" },
          },
        )
      }),
    )
  }
  // For non-navigation requests, just fetch normally (no caching)
})

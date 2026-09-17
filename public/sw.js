// ShowSeek service worker.
// Caching policy: this worker intentionally caches NOTHING. Page/asset
// caching is handled server-side (ISR + KV); a worker-side document cache
// would serve stale content and mask server outages.
// - Navigation requests: network passthrough. HTTP error statuses (4xx/5xx)
//   are returned to the page untouched and are NEVER cached or replaced.
//   Only a network-level failure (fetch throws = device offline) falls back
//   to the offline page below.
// - All other requests: untouched by this worker (no respondWith).
// - On activate: delete every CacheStorage cache. This worker owns none, so
//   anything present is left over from a previous worker generation and must
//   not be served again (it once replayed stale error responses).

// Bump to force browsers to install the new worker on next visit.
const SW_VERSION = "v2-no-store-purge-legacy"

const OFFLINE_MESSAGE =
  "No internet connection. Please check your network and try again."

// Install event - skip waiting to activate immediately
self.addEventListener("install", (event) => {
  self.skipWaiting()
})

// Activate event - purge legacy caches, then claim all clients so the
// no-cache policy takes effect immediately (no reload required).
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

// Fetch event - network-first passthrough for navigations; offline fallback
// ONLY when the network itself fails (fetch rejects). A resolved response —
// including 4xx/5xx — is returned as-is and never written to any cache.
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

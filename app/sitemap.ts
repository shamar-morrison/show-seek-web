import type { MetadataRoute } from "next"

const SITE_URL = "https://show-seek.app"

/**
 * Sitemap for ShowSeek (served at /sitemap.xml).
 *
 * Includes the homepage and public browse/SEO routes only.
 *
 * Deliberately excluded:
 * - Auth-gated or user-specific routes (/profile, /ratings, /lists/*,
 *   /for-you) and sign-in-walled pages (/calendar, /where-to-watch via
 *   RouteGuard) — Googlebot would only ever see a login wall there.
 * - /search (empty search page, no indexable content).
 * - Dynamic detail pages (/movie/[id], /tv/[id], /person/[id],
 *   /collection/[id] and nested credit/season/episode routes) — effectively
 *   infinite, not enumerable here. See the trending-titles note below.
 * - /popular-tv does not exist as a route (only /popular-movies does), so it
 *   must not be listed (would 404 in Search Console).
 *
 * NOTE (optional, not implemented): a bounded set of currently
 * popular/trending title pages could be added by fetching TMDB's trending
 * lists inside this function and mapping the top N ids to
 * /movie/[id] and /tv/[id] URLs. Confirm before implementing — it adds an
 * external fetch to sitemap generation and needs a cap + caching strategy.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  const routes: Array<{
    path: string
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]
    priority: number
  }> = [
    { path: "/", changeFrequency: "daily", priority: 1.0 },
    { path: "/trending-tv", changeFrequency: "daily", priority: 0.9 },
    { path: "/trending-movies", changeFrequency: "daily", priority: 0.9 },
    { path: "/popular-movies", changeFrequency: "weekly", priority: 0.8 },
    { path: "/top-rated-movies", changeFrequency: "weekly", priority: 0.8 },
    { path: "/top-rated-tv", changeFrequency: "weekly", priority: 0.8 },
    { path: "/upcoming-movies", changeFrequency: "weekly", priority: 0.8 },
    { path: "/upcoming-tv", changeFrequency: "weekly", priority: 0.8 },
    { path: "/discover", changeFrequency: "weekly", priority: 0.7 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  ]

  return routes.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }))
}

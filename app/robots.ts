import type { MetadataRoute } from "next"

const SITE_URL = "https://show-seek.app"

/**
 * Robots rules for ShowSeek (served at /robots.txt).
 *
 * AhrefsBot and AwarioBot were observed (Sep 18-22, 2026) systematically
 * enumerating the effectively infinite /movie/[id], /tv/[id], and
 * /person/[id] detail routes at ~2 req/sec around the clock. Every
 * first-touch detail URL fans out to several TMDB API calls and KV
 * fetch-cache writes, which drove a ~175x KV write spike and ~1.4M
 * accumulated cache keys in four days. These crawlers add no search
 * traffic value, so they are disallowed entirely while all other
 * user agents (including Googlebot, which only needs the sitemap
 * browse routes) remain allowed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "AhrefsBot",
        disallow: "/",
      },
      {
        userAgent: "AwarioBot",
        disallow: "/",
      },
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}

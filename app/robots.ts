import type { MetadataRoute } from "next"

const SITE_URL = "https://show-seek.app"

/**
 * Robots rules for ShowSeek (served at /robots.txt).
 *
 * Only Google's crawlers are welcome. All other bots are also blocked at the
 * Cloudflare WAF (rule "Block all bots except Googlebot"), so this file is
 * the polite, advisory layer; the WAF is the enforcement layer.
 *
 * History: AhrefsBot/Awario (Sep 18-22, 2026) and ShapBot/Applebot
 * (Sep 28-30, 2026) enumerated the effectively infinite /movie/[id],
 * /tv/[id], /person/[id] routes, causing millions of KV cache writes.
 *
 * Googlebot is kept out of filter/search combinations, which are
 * high-cardinality and produce a cache entry per query string.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: ["Googlebot", "Google-InspectionTool"],
        allow: "/",
        disallow: ["/api/", "/search", "/discover?*"],
      },
      {
        userAgent: "*",
        disallow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}

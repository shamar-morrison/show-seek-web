import { defineCloudflareConfig } from "@opennextjs/cloudflare"
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache"
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue"
import kvIncrementalCache from "./overrides/kv-incremental-cache-with-ttl"

const incrementalCache = withRegionalCache(kvIncrementalCache, {
  mode: "long-lived",
  shouldLazilyUpdateOnCacheHit: false,
})

export default defineCloudflareConfig({
  incrementalCache,
  queue: doQueue,
})

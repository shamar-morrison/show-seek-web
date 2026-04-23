import { defineCloudflareConfig } from "@opennextjs/cloudflare"
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache"
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache"
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue"

const incrementalCache = withRegionalCache(kvIncrementalCache, {
  mode: "long-lived",
  shouldLazilyUpdateOnCacheHit: false,
})

export default defineCloudflareConfig({
  incrementalCache,
  queue: doQueue,
})

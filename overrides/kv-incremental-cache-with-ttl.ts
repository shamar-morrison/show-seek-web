/**
 * KV incremental cache with expiration TTL on writes.
 *
 * Identical to the adapter's `kvIncrementalCache`
 * (`@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache`)
 * except every `put` carries `expirationTtl`, so entries age out instead of
 * accumulating forever across deploys (the adapter source carries a
 * "Figure out how to best leverage KV's TTL" TODO and passes no TTL).
 *
 * TTL choice: 60 days (5,184,000s). The longest revalidation window in the
 * app is 30 days (TMDB image/person responses, logo-darkness booleans), so
 * 60 days guarantees every entry type survives at least 2x its full
 * revalidation window — normal revalidation always hits cache — while
 * bounding accumulation to ~2 months of keys per build instead of forever.
 * Applies uniformly to `.cache` (ISR/route) and `.fetch` entries.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare/cloudflare-context"
import {
  computeCacheKey,
  debugCache,
} from "@opennextjs/cloudflare/overrides/internal"

export const NAME = "cf-kv-incremental-cache-ttl"
export const BINDING_NAME = "NEXT_INC_CACHE_KV"
export const PREFIX_ENV_NAME = "NEXT_INC_CACHE_KV_PREFIX"

// Local equivalent of the adapter's IgnorableError (avoids importing
// @opennextjs/aws internals, which ship without type declarations).
class IgnorableError extends Error {
  __openNextInternal = true
  canIgnore = true
  logLevel = 0
}

function logError(message: string, e: unknown) {
  console.error(message, e)
}

/** 60 days in seconds. See header comment for rationale. */
export const CACHE_ENTRY_TTL_SECONDS = 5_184_000

interface TtlKvNamespace {
  get(key: string, type: "json"): Promise<unknown>
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>
  delete(key: string): Promise<void>
}

function getKv(): TtlKvNamespace | null {
  const kv = (
    getCloudflareContext().env as unknown as Record<string, unknown>
  )[BINDING_NAME] as TtlKvNamespace | undefined
  return kv ?? null
}

/**
 * Open Next cache based on Cloudflare KV, with TTL on writes.
 *
 * The prefix that the cache entries are stored under can be configured with
 * the `NEXT_INC_CACHE_KV_PREFIX` environment variable, and defaults to
 * `incremental-cache`.
 */
class KVIncrementalCacheWithTtl {
  name = NAME

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async get(key: string, cacheType?: any): Promise<any> {
    const kv = getKv()
    if (!kv) throw new IgnorableError("No KV Namespace")
    debugCache(NAME, `get ${key}`)
    try {
      const entry = await kv.get(this.getKVKey(key, cacheType), "json")
      if (!entry) return null
      if (entry && typeof entry === "object" && "lastModified" in entry) {
        return entry
      }
      // if there is no lastModified property, the file was stored during build-time cache population.
      return {
        value: entry,
        lastModified: (
          globalThis as unknown as { __BUILD_TIMESTAMP_MS__?: number }
        ).__BUILD_TIMESTAMP_MS__,
      }
    } catch (e) {
      logError("Failed to get from cache", e)
      return null
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async set(key: string, value: any, cacheType?: any) {
    const kv = getKv()
    if (!kv) throw new IgnorableError("No KV Namespace")
    debugCache(NAME, `set ${key}`)
    try {
      await kv.put(
        this.getKVKey(key, cacheType),
        JSON.stringify({
          value,
          // Note: `Date.now()` returns the time of the last IO rather than the actual time.
          //       See https://developers.cloudflare.com/workers/reference/security-model/
          lastModified: Date.now(),
        }),
        { expirationTtl: CACHE_ENTRY_TTL_SECONDS },
      )
    } catch (e) {
      logError("Failed to set to cache", e)
    }
  }

  async delete(key: string) {
    const kv = getKv()
    if (!kv) throw new IgnorableError("No KV Namespace")
    debugCache(NAME, `delete ${key}`)
    try {
      // Only cache that gets deleted is the ISR/SSG cache.
      await kv.delete(this.getKVKey(key, "cache"))
    } catch (e) {
      logError("Failed to delete from cache", e)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getKVKey(key: string, cacheType?: any) {
    return computeCacheKey(key, {
      prefix: (
        getCloudflareContext().env as unknown as Record<string, unknown>
      )[PREFIX_ENV_NAME] as string | undefined,
      buildId: process.env.OPEN_NEXT_BUILD_ID,
      cacheType,
    })
  }
}

const kvIncrementalCacheWithTtl = new KVIncrementalCacheWithTtl()

export default kvIncrementalCacheWithTtl

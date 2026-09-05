import { existsSync, readdirSync, rmSync } from "node:fs"
import path from "node:path"

export function countFilesRecursively(dir) {
  if (!existsSync(dir)) return 0
  let count = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      count += countFilesRecursively(full)
    } else if (entry.isFile()) {
      count += 1
    }
  }
  return count
}

export function pruneFetchCache(options = {}) {
  const openNextDir = options.openNextDir ?? ".open-next"
  const fetchCacheDir = path.join(openNextDir, "cache", "__fetch")
  const baseCacheDir = path.join(openNextDir, "cache")

  let prunedCount = 0
  if (existsSync(fetchCacheDir)) {
    prunedCount = countFilesRecursively(fetchCacheDir)
    rmSync(fetchCacheDir, { recursive: true, force: true })
    console.log(
      `[Cloudflare Free Plan] Pruned ${prunedCount} build-time fetch-cache entries from ${fetchCacheDir}.`,
    )
  }

  let remainingPageCaches = 0
  if (existsSync(baseCacheDir)) {
    remainingPageCaches = countFilesRecursively(baseCacheDir)
  }

  console.log(
    `[Cloudflare Free Plan] Retained ${remainingPageCaches} page/route cache entries for Workers KV upload (estimated ${remainingPageCaches} KV PUTs on deploy).`,
  )

  return { prunedCount, remainingPageCaches }
}

// Execute directly if run via node CLI
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith("cloudflare-prune-fetch-cache.mjs") ||
    import.meta.url.endsWith(path.basename(process.argv[1])))

if (isDirectRun) {
  pruneFetchCache()
}

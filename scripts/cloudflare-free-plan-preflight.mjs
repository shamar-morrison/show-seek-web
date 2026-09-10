import { spawnSync } from "node:child_process"
import { pruneFetchCache } from "./cloudflare-prune-fetch-cache.mjs"

// Cloudflare limit (Sept 2026+): single 64 MiB uncompressed bundle size limit
// across both Free and Paid plans. No separate gzip-based free-tier check.
const MAX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024 // 67108864 bytes

function parseArgs(argv) {
  const args = {
    configPath: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--config" || arg === "-c") {
      args.configPath = argv[index + 1] ?? null
      index += 1
    }
  }

  return args
}

function toBytes(value, unit) {
  const normalizedUnit = unit.toLowerCase()

  if (normalizedUnit === "b") return value
  if (normalizedUnit === "kib") return value * 1024
  if (normalizedUnit === "mib") return value * 1024 * 1024
  if (normalizedUnit === "gib") return value * 1024 * 1024 * 1024
  if (normalizedUnit === "kb") return value * 1000
  if (normalizedUnit === "mb") return value * 1000 * 1000
  if (normalizedUnit === "gb") return value * 1000 * 1000 * 1000

  throw new Error(`Unsupported size unit: ${unit}`)
}

// Prune build-time fetch-cache entries so KV limit of 1000 puts/day is preserved
pruneFetchCache()

const { configPath } = parseArgs(process.argv.slice(2))
const wranglerArgs = ["exec", "wrangler"]

if (configPath) {
  wranglerArgs.push("--config", configPath)
}

wranglerArgs.push("deploy", "--dry-run", "--outdir", ".open-next/dry-run")

const result = spawnSync(
  "pnpm",
  wranglerArgs,
  {
    encoding: "utf8",
    shell: process.platform === "win32",
  },
)

if (result.error) {
  throw result.error
}

const combinedOutput = `${result.stdout}\n${result.stderr}`
process.stdout.write(result.stdout)
process.stderr.write(result.stderr)

if ((result.status ?? 1) !== 0) {
  process.exit(result.status ?? 1)
}

const uncompressedMatch = combinedOutput.match(
  /Total Upload:\s*([\d.]+)\s*(B|KiB|MiB|GiB|KB|MB|GB)/i,
)

if (!uncompressedMatch) {
  console.error(
    "Unable to determine the uncompressed worker size from Wrangler dry-run output.",
  )
  process.exit(1)
}

const uncompressedSize = Number.parseFloat(uncompressedMatch[1] ?? "0")
const uncompressedUnit = uncompressedMatch[2] ?? "B"
const uncompressedBytes = toBytes(uncompressedSize, uncompressedUnit)

console.log(
  `Detected uncompressed worker size: ${uncompressedSize} ${uncompressedUnit} (${Math.round(
    uncompressedBytes,
  )} bytes)`,
)

if (uncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
  console.error(
    `Uncompressed worker size exceeds the Cloudflare limit of ${MAX_UNCOMPRESSED_BYTES} bytes (64 MiB).`,
  )
  process.exit(1)
}

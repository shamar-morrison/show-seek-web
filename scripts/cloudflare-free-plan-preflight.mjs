import { spawnSync } from "node:child_process"

const FREE_PLAN_MAX_GZIP_BYTES = 3 * 1024 * 1024

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

const result = spawnSync(
  "pnpm",
  ["exec", "wrangler", "deploy", "--dry-run", "--outdir", ".open-next/dry-run"],
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

const gzipMatch =
  combinedOutput.match(/gzip:\s*([\d.]+)\s*(B|KiB|MiB|GiB|KB|MB|GB)/i) ??
  combinedOutput.match(
    /compressed(?: upload)? size[:\s]+([\d.]+)\s*(B|KiB|MiB|GiB|KB|MB|GB)/i,
  )

if (!gzipMatch) {
  console.error(
    "Unable to determine the compressed worker size from Wrangler dry-run output.",
  )
  process.exit(1)
}

const gzipSize = Number.parseFloat(gzipMatch[1] ?? "0")
const gzipUnit = gzipMatch[2] ?? "B"
const gzipBytes = toBytes(gzipSize, gzipUnit)

console.log(
  `Detected compressed worker size: ${gzipSize} ${gzipUnit} (${Math.round(
    gzipBytes,
  )} bytes)`,
)

if (gzipBytes > FREE_PLAN_MAX_GZIP_BYTES) {
  console.error(
    `Compressed worker size exceeds the Cloudflare free-plan limit of ${FREE_PLAN_MAX_GZIP_BYTES} bytes.`,
  )
  process.exit(1)
}

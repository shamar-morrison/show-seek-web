import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"

const MAX_FREE_PLAN_VARS = 64
const DEFAULT_ENV_PATH = ".env"
const RUNTIME_SECRET_KEYS = [
  "FIREBASE_ADMIN_PROJECT_ID",
  "FIREBASE_ADMIN_CLIENT_EMAIL",
  "FIREBASE_ADMIN_PRIVATE_KEY",
  "TRAKT_CLIENT_ID",
]

function parseArgs(argv) {
  const args = {
    dryRun: false,
    envFile: DEFAULT_ENV_PATH,
    envName: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--dry-run") {
      args.dryRun = true
      continue
    }

    if (arg === "--env-file") {
      args.envFile = argv[index + 1] ?? DEFAULT_ENV_PATH
      index += 1
      continue
    }

    if (arg === "--env") {
      args.envName = argv[index + 1] ?? null
      index += 1
    }
  }

  return args
}

function parseEnvFile(contents) {
  const entries = {}

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line || line.startsWith("#")) {
      continue
    }

    const separatorIndex = line.indexOf("=")

    if (separatorIndex === -1) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    let value = line.slice(separatorIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    entries[key] = value
  }

  return entries
}

function buildSecretPayload(parsedEnv) {
  const payload = {}

  for (const key of RUNTIME_SECRET_KEYS) {
    const value = parsedEnv[key]

    if (typeof value === "string" && value !== "") {
      payload[key] = value
    }
  }

  const tmdbBearer = parsedEnv.TMDB_BEARER_TOKEN
  const tmdbApiKey = parsedEnv.TMDB_API_KEY

  if (typeof tmdbBearer === "string" && tmdbBearer !== "") {
    payload.TMDB_BEARER_TOKEN = tmdbBearer
  } else if (typeof tmdbApiKey === "string" && tmdbApiKey !== "") {
    payload.TMDB_API_KEY = tmdbApiKey
  }

  return payload
}

function runWranglerSecretBulk({ tempFile, envName }) {
  const args = ["exec", "wrangler", "secret", "bulk", tempFile]

  if (envName) {
    args.push("--env", envName)
  }

  return spawnSync("pnpm", args, {
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: "inherit",
  })
}

const { dryRun, envFile, envName } = parseArgs(process.argv.slice(2))
const envContents = readFileSync(envFile, "utf8")
const parsedEnv = parseEnvFile(envContents)
const payload = buildSecretPayload(parsedEnv)
const keys = Object.keys(payload).sort()

if (keys.length === 0) {
  console.error(`No runtime secrets found in ${envFile}`)
  process.exit(1)
}

if (keys.length > MAX_FREE_PLAN_VARS) {
  console.error(
    `Refusing to sync ${keys.length} secrets because the free-plan limit is ${MAX_FREE_PLAN_VARS} vars per worker.`,
  )
  process.exit(1)
}

console.log(`Prepared ${keys.length} runtime secrets from ${envFile}:`)
for (const key of keys) {
  console.log(`- ${key}`)
}

if (dryRun) {
  process.exit(0)
}

const tempDir = mkdtempSync(path.join(tmpdir(), "cf-secret-sync-"))
const tempFile = path.join(tempDir, "secrets.json")

try {
  writeFileSync(tempFile, JSON.stringify(payload, null, 2))
  const result = runWranglerSecretBulk({ tempFile, envName })

  if (result.error) {
    throw result.error
  }

  process.exit(result.status ?? 1)
} finally {
  rmSync(tempDir, { force: true, recursive: true })
}

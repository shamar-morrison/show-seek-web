import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const REQUIRED_FIREBASE_BUILD_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
]
const TMDB_BUILD_KEYS = ["TMDB_BEARER_TOKEN", "TMDB_API_KEY"]
const buildEnv =
  process.env.NODE_ENV === "test" ? "test" : "production"

function parseEnvFile(contents) {
  const parsed = {}

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
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1)
    }

    parsed[key] = value
  }

  return parsed
}

function loadBuildEnvFiles() {
  const loadedEnv = {}
  const envFiles = [
    ".env",
    `.env.${buildEnv}`,
    ".env.local",
    `.env.${buildEnv}.local`,
  ]

  for (const envFile of envFiles) {
    const envPath = path.join(process.cwd(), envFile)

    if (!existsSync(envPath)) {
      continue
    }

    Object.assign(loadedEnv, parseEnvFile(readFileSync(envPath, "utf8")))
  }

  return loadedEnv
}

const loadedEnv = loadBuildEnvFiles()

function getEnvValue(key) {
  const runtimeValue = process.env[key]

  if (typeof runtimeValue === "string" && runtimeValue.trim() !== "") {
    return runtimeValue.trim()
  }

  const fileValue = loadedEnv[key]
  return typeof fileValue === "string" ? fileValue.trim() : ""
}

const missingFirebaseBuildKeys = REQUIRED_FIREBASE_BUILD_KEYS.filter(
  (key) => getEnvValue(key) === "",
)
const hasTmdbCredential = TMDB_BUILD_KEYS.some((key) => getEnvValue(key) !== "")

if (missingFirebaseBuildKeys.length === 0 && hasTmdbCredential) {
  console.log("Build environment validation passed.")
  process.exit(0)
}

console.error("Build environment validation failed.")

if (missingFirebaseBuildKeys.length > 0) {
  console.error(
    `- Missing required Firebase build env vars: ${missingFirebaseBuildKeys.join(", ")}`,
  )
}

if (!hasTmdbCredential) {
  console.error(
    `- Missing TMDB build credential: set ${TMDB_BUILD_KEYS.join(" or ")}.`,
  )
}

console.error(
  "Cloudflare Git builds must set these values in Build variables and secrets. Local builds can supply them via .env or .env.local.",
)
process.exit(1)

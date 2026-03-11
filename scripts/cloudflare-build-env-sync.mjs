import { readFileSync } from "node:fs"

const DEFAULT_ENV_PATH = ".env"
const FIREBASE_BUILD_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
]
const REQUIRED_CONFIG_KEYS = [
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_BUILD_TRIGGER_ID",
]
const TMDB_BUILD_KEYS = ["TMDB_BEARER_TOKEN", "TMDB_API_KEY"]
const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4"

function parseArgs(argv) {
  const args = {
    dryRun: false,
    envFile: DEFAULT_ENV_PATH,
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

function readEnvFileOrExit(envFile) {
  try {
    return readFileSync(envFile, "utf8")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Failed to read env file at ${envFile}: ${message}`)
    process.exit(1)
  }
}

function getMissingConfigKeys() {
  return REQUIRED_CONFIG_KEYS.filter((key) => {
    const value = process.env[key]
    return typeof value !== "string" || value.trim() === ""
  })
}

function buildBuildEnvPayload(parsedEnv, envFile) {
  const upsertPayload = {}

  for (const key of FIREBASE_BUILD_KEYS) {
    const value = parsedEnv[key]

    if (typeof value !== "string" || value === "") {
      console.error(`Missing required Firebase build env var ${key} in ${envFile}.`)
      process.exit(1)
    }

    upsertPayload[key] = {
      is_secret: false,
      value,
    }
  }

  const bearerToken = parsedEnv.TMDB_BEARER_TOKEN
  const apiKey = parsedEnv.TMDB_API_KEY

  if (typeof bearerToken === "string" && bearerToken !== "") {
    upsertPayload.TMDB_BEARER_TOKEN = {
      is_secret: true,
      value: bearerToken,
    }

    return {
      deleteKeys: ["TMDB_API_KEY"],
      upsertPayload,
    }
  }

  if (typeof apiKey === "string" && apiKey !== "") {
    upsertPayload.TMDB_API_KEY = {
      is_secret: true,
      value: apiKey,
    }

    return {
      deleteKeys: ["TMDB_BEARER_TOKEN"],
      upsertPayload,
    }
  }

  console.error(
    `No TMDB build secret found in ${envFile}. Set ${TMDB_BUILD_KEYS.join(" or ")}.`,
  )
  process.exit(1)
}

async function cloudflareApiRequest(path, init) {
  const response = await fetch(`${CLOUDFLARE_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  })

  if (response.ok) {
    return response
  }

  const body = await response.text()
  throw new Error(
    `Cloudflare API request failed (${response.status} ${response.statusText}): ${body}`,
  )
}

async function upsertBuildEnvVariables(triggerId, upsertPayload) {
  await cloudflareApiRequest(
    `/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/builds/triggers/${triggerId}/environment_variables`,
    {
      body: JSON.stringify(upsertPayload, null, 2),
      method: "PATCH",
    },
  )
}

async function deleteBuildEnvVariable(triggerId, key) {
  await cloudflareApiRequest(
    `/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/builds/triggers/${triggerId}/environment_variables/${key}`,
    {
      method: "DELETE",
    },
  )
}

const { dryRun, envFile } = parseArgs(process.argv.slice(2))
const missingConfigKeys = getMissingConfigKeys()

if (missingConfigKeys.length > 0) {
  console.error(
    `Missing required Cloudflare config env vars: ${missingConfigKeys.join(", ")}`,
  )
  process.exit(1)
}

const envContents = readEnvFileOrExit(envFile)
const parsedEnv = parseEnvFile(envContents)
const { deleteKeys, upsertPayload } = buildBuildEnvPayload(parsedEnv, envFile)
const upsertKeys = Object.keys(upsertPayload)

console.log(`Prepared ${upsertKeys.length} build secret payload from ${envFile}:`)
for (const key of upsertKeys) {
  const visibility = upsertPayload[key].is_secret ? "secret" : "variable"
  console.log(`- upsert ${key} (${visibility})`)
}
for (const key of deleteKeys) {
  console.log(`- delete ${key} if present`)
}

if (dryRun) {
  console.log("Dry run only; no Cloudflare API requests sent.")
  process.exit(0)
}

const triggerId = process.env.CLOUDFLARE_BUILD_TRIGGER_ID

try {
  await upsertBuildEnvVariables(triggerId, upsertPayload)

  for (const key of deleteKeys) {
    try {
      await deleteBuildEnvVariable(triggerId, key)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      if (message.includes("404")) {
        continue
      }

      throw error
    }
  }

  console.log("Cloudflare build secret sync complete.")
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exit(1)
}

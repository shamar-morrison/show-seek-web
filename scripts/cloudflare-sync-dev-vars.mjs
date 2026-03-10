import { readFileSync, writeFileSync } from "node:fs"

const SOURCE_ENV_PATH = ".env"
const DEV_VARS_PATH = ".dev.vars"

function parseEnvFile(contents) {
  const entries = []

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
      ((value[0] === '"' && value[value.length - 1] === '"') ||
        (value[0] === "'" && value[value.length - 1] === "'"))
    ) {
      value = value.slice(1, -1)
    }

    entries.push([key, value])
  }

  return entries
}

let sourceEnv

try {
  sourceEnv = readFileSync(SOURCE_ENV_PATH, "utf8")
} catch (error) {
  const errorCode =
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : null
  const errorMessage = error instanceof Error ? error.message : String(error)

  if (errorCode === "ENOENT") {
    console.error(`.env file not found at ${SOURCE_ENV_PATH}`)
  } else {
    console.error(
      `Failed to read source env file at ${SOURCE_ENV_PATH}: ${errorMessage}`,
    )
  }

  process.exit(1)
}

const entries = parseEnvFile(sourceEnv)
const lines = ["NEXTJS_ENV=development"]

for (const [key, value] of entries) {
  if (key === "NEXTJS_ENV") {
    continue
  }

  lines.push(`${key}=${value}`)
}

writeFileSync(DEV_VARS_PATH, `${lines.join("\n")}\n`)

console.log(`Generated ${DEV_VARS_PATH} from ${SOURCE_ENV_PATH}`)

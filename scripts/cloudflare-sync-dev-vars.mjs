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
    const value = line.slice(separatorIndex + 1)

    entries.push([key, value])
  }

  return entries
}

const sourceEnv = readFileSync(SOURCE_ENV_PATH, "utf8")
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

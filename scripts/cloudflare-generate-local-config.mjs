import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const DEFAULT_ENV_PATH = ".env"
const DEFAULT_BASE_CONFIG_PATH = "wrangler.jsonc"
const DEFAULT_OUTPUT_PATH = ".wrangler/wrangler.local.jsonc"
const REQUIRED_PUBLIC_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
]
const OPTIONAL_LOCAL_VAR_KEYS = [
  "NEXT_PUBLIC_ENABLE_PREMIUM_RECONCILE",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID",
  "NEXT_PUBLIC_ANDROID_PACKAGE_NAME",
  "NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION",
  "TRAKT_REDIRECT_URI",
  "TRAKT_BACKEND_URL",
]

function parseArgs(argv) {
  const args = {
    baseConfigPath: DEFAULT_BASE_CONFIG_PATH,
    envFile: DEFAULT_ENV_PATH,
    nextjsEnv: null,
    outputPath: DEFAULT_OUTPUT_PATH,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--env-file") {
      args.envFile = argv[index + 1] ?? DEFAULT_ENV_PATH
      index += 1
      continue
    }

    if (arg === "--base-config") {
      args.baseConfigPath = argv[index + 1] ?? DEFAULT_BASE_CONFIG_PATH
      index += 1
      continue
    }

    if (arg === "--output") {
      args.outputPath = argv[index + 1] ?? DEFAULT_OUTPUT_PATH
      index += 1
      continue
    }

    if (arg === "--nextjs-env") {
      args.nextjsEnv = argv[index + 1] ?? null
      index += 1
    }
  }

  return args
}

function readFileOrExit(filePath, label) {
  try {
    return readFileSync(filePath, "utf8")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Failed to read ${label} at ${filePath}: ${message}`)
    process.exit(1)
  }
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
      value.length >= 2 &&
      ((value[0] === '"' && value[value.length - 1] === '"') ||
        (value[0] === "'" && value[value.length - 1] === "'"))
    ) {
      value = value.slice(1, -1)
    }

    entries[key] = value
  }

  return entries
}

function stripJsonComments(contents) {
  let result = ""
  let inString = false
  let stringQuote = ""
  let isEscaping = false
  let inLineComment = false
  let inBlockComment = false

  for (let index = 0; index < contents.length; index += 1) {
    const char = contents[index]
    const nextChar = contents[index + 1]

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false
        result += char
      }
      continue
    }

    if (inBlockComment) {
      if (char === "*" && nextChar === "/") {
        inBlockComment = false
        index += 1
      }
      continue
    }

    if (inString) {
      result += char

      if (isEscaping) {
        isEscaping = false
        continue
      }

      if (char === "\\") {
        isEscaping = true
        continue
      }

      if (char === stringQuote) {
        inString = false
        stringQuote = ""
      }

      continue
    }

    if (char === "/" && nextChar === "/") {
      inLineComment = true
      index += 1
      continue
    }

    if (char === "/" && nextChar === "*") {
      inBlockComment = true
      index += 1
      continue
    }

    if (char === '"' || char === "'") {
      inString = true
      stringQuote = char
      result += char
      continue
    }

    result += char
  }

  return result
}

function parseJsonc(contents) {
  const withoutComments = stripJsonComments(contents)
  const normalized = withoutComments.replace(/,\s*([}\]])/g, "$1")

  try {
    return JSON.parse(normalized)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Failed to parse Wrangler config: ${message}`)
    process.exit(1)
  }
}

function toPosixPath(value) {
  return value.split(path.sep).join("/")
}

function rewriteRelativePathForOutput(value, baseConfigPath, outputPath) {
  if (typeof value !== "string" || value === "") {
    return value
  }

  if (path.isAbsolute(value)) {
    return value
  }

  const absoluteValuePath = path.resolve(path.dirname(baseConfigPath), value)
  const absoluteOutputDir = path.resolve(path.dirname(outputPath))
  const rewrittenPath = path.relative(absoluteOutputDir, absoluteValuePath)

  return toPosixPath(rewrittenPath || ".")
}

function buildLocalVars(parsedEnv, nextjsEnvOverride, envFile) {
  const vars = {
    NEXTJS_ENV: nextjsEnvOverride ?? parsedEnv.NEXTJS_ENV ?? "production",
  }

  for (const key of REQUIRED_PUBLIC_KEYS) {
    const value = parsedEnv[key]

    if (typeof value !== "string" || value === "") {
      console.error(
        `Missing required local deploy env var ${key} in ${envFile}.`,
      )
      process.exit(1)
    }

    vars[key] = value
  }

  for (const key of OPTIONAL_LOCAL_VAR_KEYS) {
    const value = parsedEnv[key]

    if (typeof value === "string" && value !== "") {
      vars[key] = value
    }
  }

  return vars
}

const { baseConfigPath, envFile, nextjsEnv, outputPath } = parseArgs(
  process.argv.slice(2),
)
const envContents = readFileOrExit(envFile, "env file")
const baseConfigContents = readFileOrExit(baseConfigPath, "Wrangler config")
const parsedEnv = parseEnvFile(envContents)
const baseConfig = parseJsonc(baseConfigContents)
const rewrittenMain = rewriteRelativePathForOutput(
  baseConfig.main,
  baseConfigPath,
  outputPath,
)
const rewrittenSchema = rewriteRelativePathForOutput(
  baseConfig.$schema,
  baseConfigPath,
  outputPath,
)
const rewrittenAssetsDirectory =
  baseConfig.assets && typeof baseConfig.assets === "object"
    ? rewriteRelativePathForOutput(
        baseConfig.assets.directory,
        baseConfigPath,
        outputPath,
      )
    : null
const localConfig = {
  ...baseConfig,
  $schema: rewrittenSchema,
  main: rewrittenMain,
  assets:
    baseConfig.assets && typeof baseConfig.assets === "object"
      ? {
          ...baseConfig.assets,
          directory: rewrittenAssetsDirectory,
        }
      : baseConfig.assets,
  vars: {
    ...(baseConfig.vars ?? {}),
    ...buildLocalVars(parsedEnv, nextjsEnv, envFile),
  },
}

mkdirSync(path.dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify(localConfig, null, 2)}\n`)

console.log(`Generated ${outputPath} from ${baseConfigPath} and ${envFile}`)
for (const key of Object.keys(localConfig.vars)) {
  console.log(`- ${key}`)
}

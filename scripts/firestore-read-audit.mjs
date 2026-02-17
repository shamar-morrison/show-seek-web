import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const SOURCE_DIRS = ["app", "components", "context", "hooks", "lib", "services"]
const ALLOWED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"])

const OPERATION_WEIGHTS = {
  onSnapshot: 12,
  auditedOnSnapshot: 12,
  getDocs: 6,
  auditedGetDocs: 6,
  getDoc: 2,
  auditedGetDoc: 2,
}

const OPERATION_REGEX =
  /\b(onSnapshot|auditedOnSnapshot|getDocs|auditedGetDocs|getDoc|auditedGetDoc)\s*\(/g

const allowedSnapshotFiles = ["context/auth-context.tsx", "hooks/use-preferences.ts"]

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/")
}

function walkFiles(dirPath, collector) {
  let entries = []

  try {
    entries = readdirSync(dirPath)
  } catch {
    return
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry)
    let stats

    try {
      stats = statSync(fullPath)
    } catch {
      continue
    }

    if (stats.isDirectory()) {
      walkFiles(fullPath, collector)
      continue
    }

    const extension = path.extname(entry)
    if (ALLOWED_EXTENSIONS.has(extension)) {
      collector.push(fullPath)
    }
  }
}

function getLineNumber(content, index) {
  return content.slice(0, index).split("\n").length
}

const filesToScan = []
for (const sourceDir of SOURCE_DIRS) {
  walkFiles(path.join(ROOT, sourceDir), filesToScan)
}

const byOperation = {
  onSnapshot: 0,
  auditedOnSnapshot: 0,
  getDocs: 0,
  auditedGetDocs: 0,
  getDoc: 0,
  auditedGetDoc: 0,
}

const fileStats = new Map()
const snapshotCallsites = []

for (const fullPath of filesToScan) {
  const relativePath = toPosixPath(path.relative(ROOT, fullPath))
  const content = readFileSync(fullPath, "utf8")

  let match
  while ((match = OPERATION_REGEX.exec(content)) !== null) {
    const operation = match[1]
    byOperation[operation] += 1

    const existing = fileStats.get(relativePath) ?? {
      path: relativePath,
      totalCallsites: 0,
      weightedScore: 0,
      operations: {
        onSnapshot: 0,
        auditedOnSnapshot: 0,
        getDocs: 0,
        auditedGetDocs: 0,
        getDoc: 0,
        auditedGetDoc: 0,
      },
    }

    existing.totalCallsites += 1
    existing.weightedScore += OPERATION_WEIGHTS[operation]
    existing.operations[operation] += 1
    fileStats.set(relativePath, existing)

    if (operation === "onSnapshot" || operation === "auditedOnSnapshot") {
      snapshotCallsites.push({
        file: relativePath,
        operation,
        line: getLineNumber(content, match.index),
      })
    }
  }

  OPERATION_REGEX.lastIndex = 0
}

const topFiles = [...fileStats.values()]
  .sort((a, b) => {
    if (b.weightedScore !== a.weightedScore) {
      return b.weightedScore - a.weightedScore
    }
    return b.totalCallsites - a.totalCallsites
  })
  .slice(0, 10)

const totalCallsites = Object.values(byOperation).reduce(
  (sum, value) => sum + value,
  0,
)

const totalSnapshotListeners = byOperation.onSnapshot + byOperation.auditedOnSnapshot

const snapshotByFile = new Map()
for (const callsite of snapshotCallsites) {
  snapshotByFile.set(callsite.file, (snapshotByFile.get(callsite.file) ?? 0) + 1)
}

const violations = []

if (totalSnapshotListeners !== 2) {
  violations.push(`Expected exactly 2 snapshot listeners, found ${totalSnapshotListeners}`)
}

for (const [file, count] of snapshotByFile.entries()) {
  if (!allowedSnapshotFiles.includes(file)) {
    violations.push(`Snapshot listener not allowlisted: ${file} (${count})`)
  }
}

for (const allowedFile of allowedSnapshotFiles) {
  const count = snapshotByFile.get(allowedFile) ?? 0
  if (count !== 1) {
    violations.push(
      `Allowlisted file ${allowedFile} must contain exactly 1 snapshot listener (found ${count})`,
    )
  }
}

const policy = {
  allowedSnapshotFiles,
  totalSnapshotListeners,
  violations,
  pass: violations.length === 0,
}

const output = {
  scannedAt: new Date().toISOString(),
  totalCallsites,
  byOperation,
  topFiles,
  top5LikelyHeavyPaths: topFiles.slice(0, 5).map((file) => file.path),
  policy,
}

console.log(JSON.stringify(output, null, 2))

if (!policy.pass) {
  process.exit(1)
}

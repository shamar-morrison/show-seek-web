import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import ts from "typescript"

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

const DEFAULT_ALLOWED_SNAPSHOT_FILES = [
  "context/auth-context.tsx",
  "hooks/use-preferences.ts",
]

function createEmptyOperationCounts() {
  return {
    onSnapshot: 0,
    auditedOnSnapshot: 0,
    getDocs: 0,
    auditedGetDocs: 0,
    getDoc: 0,
    auditedGetDoc: 0,
  }
}

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

    if (ALLOWED_EXTENSIONS.has(path.extname(entry))) {
      collector.push(fullPath)
    }
  }
}

function getLineNumber(content, index) {
  return content.slice(0, index).split("\n").length
}

function getScriptKind(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === ".tsx") return ts.ScriptKind.TSX
  if (ext === ".jsx") return ts.ScriptKind.JSX
  if (ext === ".js") return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

function getCalleeName(expression) {
  if (ts.isIdentifier(expression)) {
    return expression.text
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text
  }
  if (
    ts.isElementAccessExpression(expression) &&
    ts.isStringLiteralLike(expression.argumentExpression)
  ) {
    return expression.argumentExpression.text
  }

  return null
}

function collectOperationMatchesWithRegex(content) {
  const matches = []
  OPERATION_REGEX.lastIndex = 0

  let match
  while ((match = OPERATION_REGEX.exec(content)) !== null) {
    matches.push({
      operation: match[1],
      line: getLineNumber(content, match.index),
    })
  }

  OPERATION_REGEX.lastIndex = 0
  return matches
}

function collectOperationMatches(content, filePath) {
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(filePath),
  )

  if (sourceFile.parseDiagnostics.length > 0) {
    return collectOperationMatchesWithRegex(content)
  }

  const matches = []

  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const calleeName = getCalleeName(node.expression)
      if (calleeName && Object.hasOwn(OPERATION_WEIGHTS, calleeName)) {
        const position = node.expression.getStart(sourceFile)
        const line = sourceFile.getLineAndCharacterOfPosition(position).line + 1
        matches.push({
          operation: calleeName,
          line,
        })
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return matches
}

export async function main(options = {}) {
  const root = path.resolve(options.root ?? ROOT)
  const sourceDirs = options.sourceDirs ?? SOURCE_DIRS
  const allowedSnapshotFiles =
    options.allowedSnapshotFiles ?? DEFAULT_ALLOWED_SNAPSHOT_FILES

  const filesToScan = []
  for (const sourceDir of sourceDirs) {
    walkFiles(path.join(root, sourceDir), filesToScan)
  }

  const byOperation = createEmptyOperationCounts()
  const fileStats = new Map()
  const snapshotCallsites = []

  for (const fullPath of filesToScan) {
    const relativePath = toPosixPath(path.relative(root, fullPath))
    const content = readFileSync(fullPath, "utf8")
    const matches = collectOperationMatches(content, fullPath)

    for (const match of matches) {
      byOperation[match.operation] += 1

      const existing = fileStats.get(relativePath) ?? {
        path: relativePath,
        totalCallsites: 0,
        weightedScore: 0,
        operations: createEmptyOperationCounts(),
      }

      existing.totalCallsites += 1
      existing.weightedScore += OPERATION_WEIGHTS[match.operation]
      existing.operations[match.operation] += 1
      fileStats.set(relativePath, existing)

      if (
        match.operation === "onSnapshot" ||
        match.operation === "auditedOnSnapshot"
      ) {
        snapshotCallsites.push({
          file: relativePath,
          operation: match.operation,
          line: match.line,
        })
      }
    }
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

  const totalSnapshotListeners =
    byOperation.onSnapshot + byOperation.auditedOnSnapshot

  const snapshotByFile = new Map()
  for (const callsite of snapshotCallsites) {
    snapshotByFile.set(callsite.file, (snapshotByFile.get(callsite.file) ?? 0) + 1)
  }

  const violations = []

  if (totalSnapshotListeners !== 2) {
    violations.push(
      `Expected exactly 2 snapshot listeners, found ${totalSnapshotListeners}`,
    )
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

  return {
    filesToScan,
    byOperation,
    fileStats,
    snapshotCallsites,
    topFiles,
    totalCallsites,
    policy,
    output,
  }
}

function isDirectExecution() {
  if (!process.argv[1]) return false
  return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
}

if (isDirectExecution()) {
  const { output, policy } = await main()
  console.log(JSON.stringify(output, null, 2))

  if (!policy.pass) {
    process.exit(1)
  }
}

export { getLineNumber, OPERATION_REGEX, OPERATION_WEIGHTS, walkFiles }

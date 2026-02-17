// @vitest-environment node

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { pathToFileURL } from "node:url"
import { afterEach, describe, expect, it } from "vitest"

const tempDirs: string[] = []

function createTempProject() {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "firestore-audit-"))
  tempDirs.push(tempDir)

  for (const dir of ["app", "components", "context", "hooks", "lib", "services"]) {
    mkdirSync(path.join(tempDir, dir), { recursive: true })
  }

  return tempDir
}

function runAudit(cwd: string) {
  const scriptPath = path.resolve(process.cwd(), "scripts/firestore-read-audit.mjs")
  const result = spawnSync("node", [scriptPath], {
    cwd,
    encoding: "utf8",
  })

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

describe("firestore-read-audit", () => {
  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("passes with exactly two allowlisted listeners", () => {
    const tempDir = createTempProject()

    writeFileSync(
      path.join(tempDir, "context/auth-context.tsx"),
      "export const x = onSnapshot(docRef, () => {})\n",
    )
    writeFileSync(
      path.join(tempDir, "hooks/use-preferences.ts"),
      "export const y = onSnapshot(docRef, () => {})\n",
    )

    const result = runAudit(tempDir)
    expect(result.status).toBe(0)

    const payload = JSON.parse(result.stdout)
    expect(payload.policy.pass).toBe(true)
    expect(payload.policy.totalSnapshotListeners).toBe(2)
  })

  it("fails when a third listener exists", () => {
    const tempDir = createTempProject()

    writeFileSync(
      path.join(tempDir, "context/auth-context.tsx"),
      "export const x = onSnapshot(docRef, () => {})\n",
    )
    writeFileSync(
      path.join(tempDir, "hooks/use-preferences.ts"),
      "export const y = onSnapshot(docRef, () => {})\n",
    )
    writeFileSync(
      path.join(tempDir, "hooks/use-extra.ts"),
      "export const z = onSnapshot(docRef, () => {})\n",
    )

    const result = runAudit(tempDir)
    expect(result.status).toBe(1)

    const payload = JSON.parse(result.stdout)
    expect(payload.policy.pass).toBe(false)
    expect(payload.policy.violations.length).toBeGreaterThan(0)
  })

  it("ignores operation names inside comments and strings", () => {
    const tempDir = createTempProject()

    writeFileSync(
      path.join(tempDir, "context/auth-context.tsx"),
      "export const x = onSnapshot(docRef, () => {})\n",
    )
    writeFileSync(
      path.join(tempDir, "hooks/use-preferences.ts"),
      "export const y = onSnapshot(docRef, () => {})\n",
    )
    writeFileSync(
      path.join(tempDir, "hooks/use-fake.ts"),
      [
        "// onSnapshot(fakeRef, () => {})",
        "const msg = \"getDoc(fakeRef)\"",
        "const template = `getDocs(fakeRef)`",
      ].join("\n"),
    )

    const result = runAudit(tempDir)
    expect(result.status).toBe(0)

    const payload = JSON.parse(result.stdout)
    expect(payload.totalCallsites).toBe(2)
    expect(payload.byOperation.getDoc).toBe(0)
    expect(payload.byOperation.getDocs).toBe(0)
    expect(payload.byOperation.onSnapshot).toBe(2)
  })

  it("exports main for import-driven execution", async () => {
    const scriptPath = path.resolve(process.cwd(), "scripts/firestore-read-audit.mjs")
    const modulePath = pathToFileURL(scriptPath).href
    const module = await import(modulePath)

    expect(typeof module.main).toBe("function")

    const tempDir = createTempProject()
    writeFileSync(
      path.join(tempDir, "context/auth-context.tsx"),
      "export const x = onSnapshot(docRef, () => {})\n",
    )
    writeFileSync(
      path.join(tempDir, "hooks/use-preferences.ts"),
      "export const y = onSnapshot(docRef, () => {})\n",
    )

    const result = await module.main({ root: tempDir })
    expect(result.policy.pass).toBe(true)
    expect(result.output.policy.totalSnapshotListeners).toBe(2)
  })
})

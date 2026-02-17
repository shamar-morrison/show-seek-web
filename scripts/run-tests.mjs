import { spawnSync } from "node:child_process"

const passthroughArgs = process.argv
  .slice(2)
  .filter((arg) => arg !== "--watchman=false")

const result = spawnSync("pnpm", ["exec", "vitest", "run", ...passthroughArgs], {
  stdio: "inherit",
  shell: process.platform === "win32",
})

if (result.error) {
  throw result.error
}

process.exit(result.status ?? 1)

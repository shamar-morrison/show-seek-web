import {
  maybeWarnTraktManagedListEdit,
  resetTraktManagedEditWarnings,
} from "@/lib/trakt-managed-edits"
import { beforeEach, describe, expect, it, vi } from "vitest"

describe("trakt-managed edit warnings", () => {
  beforeEach(() => {
    resetTraktManagedEditWarnings()
  })

  it("can reset once-per-session managed edit warnings", () => {
    const showToast = vi.fn()

    maybeWarnTraktManagedListEdit(true, ["watchlist"], showToast)
    maybeWarnTraktManagedListEdit(true, ["watchlist"], showToast)
    resetTraktManagedEditWarnings()
    maybeWarnTraktManagedListEdit(true, ["watchlist"], showToast)

    expect(showToast).toHaveBeenCalledTimes(2)
  })
})

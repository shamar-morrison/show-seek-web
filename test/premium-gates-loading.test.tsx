import {
  isPremiumStatusPending,
  shouldEnforcePremiumLock,
} from "@/lib/premium-gating"
import { describe, expect, it } from "vitest"

describe("premium gate loading behavior", () => {
  it("does not enforce premium lock while premium status is loading", () => {
    expect(
      shouldEnforcePremiumLock({
        premiumLoading: true,
        premiumStatus: "free",
      }),
    ).toBe(false)

    expect(
      shouldEnforcePremiumLock({
        premiumLoading: true,
        premiumStatus: "unknown",
      }),
    ).toBe(false)
  })

  it("treats unknown status as pending and not hard-locked", () => {
    expect(
      isPremiumStatusPending({
        premiumLoading: false,
        premiumStatus: "unknown",
      }),
    ).toBe(true)

    expect(
      shouldEnforcePremiumLock({
        premiumLoading: false,
        premiumStatus: "unknown",
      }),
    ).toBe(false)
  })

  it("enforces lock only when status is explicitly free and loading is false", () => {
    expect(
      shouldEnforcePremiumLock({
        premiumLoading: false,
        premiumStatus: "free",
      }),
    ).toBe(true)

    expect(
      shouldEnforcePremiumLock({
        premiumLoading: false,
        premiumStatus: "premium",
      }),
    ).toBe(false)
  })
})

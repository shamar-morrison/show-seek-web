import { describe, expect, it } from "vitest"
import {
  isPolarDeleteBlocked,
  isPolarSubscriptionActiveError,
} from "@/lib/polar-delete-guard"

describe("isPolarDeleteBlocked", () => {
  it("blocks active and billing-issue Polar subscriptions", () => {
    expect(
      isPolarDeleteBlocked({
        isPremium: true,
        provider: "polar",
        subscriptionState: "ACTIVE",
      }),
    ).toBe(true)
    expect(
      isPolarDeleteBlocked({
        isPremium: true,
        provider: "polar",
        subscriptionState: "BILLING_ISSUE",
      }),
    ).toBe(true)
    expect(isPolarDeleteBlocked({ isPremium: true, provider: "polar" })).toBe(
      true,
    )
  })

  it("allows cancelled, non-premium, non-polar, and missing premium", () => {
    expect(
      isPolarDeleteBlocked({
        isPremium: true,
        provider: "polar",
        subscriptionState: "CANCELLED",
      }),
    ).toBe(false)
    expect(
      isPolarDeleteBlocked({
        isPremium: false,
        provider: "polar",
        subscriptionState: "ACTIVE",
      }),
    ).toBe(false)
    expect(
      isPolarDeleteBlocked({
        isPremium: true,
        provider: "revenuecat",
        subscriptionState: "ACTIVE",
      }),
    ).toBe(false)
    expect(isPolarDeleteBlocked(null)).toBe(false)
    expect(isPolarDeleteBlocked(undefined)).toBe(false)
  })
})

describe("isPolarSubscriptionActiveError", () => {
  it("matches only the Polar active-subscription reason", () => {
    expect(
      isPolarSubscriptionActiveError({
        code: "functions/failed-precondition",
        details: { reason: "POLAR_SUBSCRIPTION_ACTIVE" },
      }),
    ).toBe(true)
    expect(isPolarSubscriptionActiveError(new Error("boom"))).toBe(false)
    expect(
      isPolarSubscriptionActiveError({
        details: { reason: "SOMETHING_ELSE" },
      }),
    ).toBe(false)
    expect(isPolarSubscriptionActiveError(null)).toBe(false)
  })
})

import { describe, expect, it } from "vitest"
import {
  isPolarDeleteBlocked,
  isPolarSubscriptionActiveError,
  isPremiumCheckoutBlocked,
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

describe("isPremiumCheckoutBlocked", () => {
  it("blocks Polar ACTIVE premium", () => {
    expect(
      isPremiumCheckoutBlocked({
        isPremium: true,
        premiumLoading: false,
        provider: "polar",
        subscriptionState: "ACTIVE",
      }),
    ).toBe(true)
  })

  it("blocks RevenueCat premium", () => {
    expect(
      isPremiumCheckoutBlocked({
        isPremium: true,
        premiumLoading: false,
        provider: "revenuecat",
        subscriptionState: "ACTIVE",
      }),
    ).toBe(true)
  })

  it("allows Polar CANCELLED grace-period resubscribe", () => {
    expect(
      isPremiumCheckoutBlocked({
        isPremium: true,
        premiumLoading: false,
        provider: "polar",
        subscriptionState: "CANCELLED",
      }),
    ).toBe(false)
  })

  it("allows non-premium users", () => {
    expect(
      isPremiumCheckoutBlocked({
        isPremium: false,
        premiumLoading: false,
        provider: null,
        subscriptionState: null,
      }),
    ).toBe(false)
  })

  it("blocks while premium status is loading", () => {
    expect(
      isPremiumCheckoutBlocked({
        isPremium: false,
        premiumLoading: true,
        provider: null,
        subscriptionState: null,
      }),
    ).toBe(true)
    expect(
      isPremiumCheckoutBlocked({
        isPremium: true,
        premiumLoading: true,
        provider: "polar",
        subscriptionState: "CANCELLED",
      }),
    ).toBe(true)
  })

  it("leaves logged-out users unchanged", () => {
    expect(
      isPremiumCheckoutBlocked({
        isPremium: false,
        premiumLoading: false,
        provider: null,
        subscriptionState: null,
      }),
    ).toBe(false)
    expect(isPremiumCheckoutBlocked(null)).toBe(false)
    expect(isPremiumCheckoutBlocked(undefined)).toBe(false)
  })
})

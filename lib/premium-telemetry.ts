"use client"

import { track } from "@vercel/analytics"
import { type PremiumStatus } from "@/lib/premium-gating"

type AnalyticsPropertyValue = string | number | boolean | null | undefined

export type PremiumTelemetryEventName =
  | "premium_snapshot_received"
  | "premium_snapshot_error"
  | "premium_reconcile_started"
  | "premium_reconcile_succeeded"
  | "premium_reconcile_failed"
  | "premium_gate_blocked_while_loading"

export interface PremiumTelemetryPayload {
  uidSuffix: string | null
  route: string
  premiumStatusBefore: PremiumStatus
  premiumStatusAfter: PremiumStatus
  timestamp: string
  attempted?: boolean
  callableName?: string
  errorCode?: string
  source?: "firestore" | "revenuecat" | "both" | "none"
}

interface CreatePremiumTelemetryPayloadInput {
  uid?: string | null
  route?: string
  premiumStatusBefore: PremiumStatus
  premiumStatusAfter: PremiumStatus
  attempted?: boolean
  callableName?: string
  errorCode?: string
  source?: "firestore" | "revenuecat" | "both" | "none"
}

const getUidSuffix = (uid?: string | null): string | null => {
  if (!uid) {
    return null
  }

  return uid.slice(-6)
}

const getCurrentRoute = (): string => {
  if (typeof window === "undefined") {
    return "server"
  }

  return window.location.pathname || "unknown"
}

export const createPremiumTelemetryPayload = ({
  uid,
  route,
  premiumStatusBefore,
  premiumStatusAfter,
  attempted,
  callableName,
  errorCode,
  source,
}: CreatePremiumTelemetryPayloadInput): PremiumTelemetryPayload => {
  return {
    uidSuffix: getUidSuffix(uid),
    route: route ?? getCurrentRoute(),
    premiumStatusBefore,
    premiumStatusAfter,
    timestamp: new Date().toISOString(),
    ...(attempted !== undefined ? { attempted } : {}),
    ...(callableName ? { callableName } : {}),
    ...(errorCode ? { errorCode } : {}),
    ...(source ? { source } : {}),
  }
}

export const trackPremiumEvent = (
  eventName: PremiumTelemetryEventName,
  payload: PremiumTelemetryPayload,
): void => {
  if (typeof window === "undefined") {
    return
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[PremiumTelemetry]", eventName, payload)
  }

  try {
    track(
      eventName,
      payload as unknown as Record<string, AnalyticsPropertyValue>,
    )
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[PremiumTelemetry] failed to track event", {
        error,
        eventName,
      })
    }
  }
}

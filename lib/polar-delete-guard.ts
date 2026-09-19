/**
 * Polar account-deletion guard (web).
 *
 * Mirrors the backend predicate in `show-seek/functions/src/accountDeletion.ts`
 * and the mobile helper in `show-seek/src/utils/accountDeletion.ts`. Keep the
 * three in sync. The server is the source of truth; this is only used to
 * surface the block in the UI before calling the callable.
 */
export const POLAR_CANCELLED_STATE = "CANCELLED"
export const POLAR_SUBSCRIPTION_ACTIVE_REASON = "POLAR_SUBSCRIPTION_ACTIVE"

export interface PolarPremiumStatus {
  isPremium?: boolean | null
  provider?: string | null
  subscriptionState?: string | null
}

export function isPolarDeleteBlocked(
  premium?: PolarPremiumStatus | null,
): boolean {
  if (!premium) {
    return false
  }
  if (premium.provider !== "polar") {
    return false
  }
  if (premium.isPremium !== true) {
    return false
  }
  return premium.subscriptionState !== POLAR_CANCELLED_STATE
}

export function isPolarSubscriptionActiveError(error: unknown): boolean {
  const details = (error as { details?: { reason?: unknown } | null } | null)
    ?.details
  return details?.reason === POLAR_SUBSCRIPTION_ACTIVE_REASON
}

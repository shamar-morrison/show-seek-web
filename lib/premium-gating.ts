export type PremiumStatus = "unknown" | "free" | "premium"

export const PREMIUM_LOADING_MESSAGE = "Checking premium status..."

interface PremiumGateState {
  premiumLoading: boolean
  premiumStatus: PremiumStatus
}

export const isPremiumStatusPending = ({
  premiumLoading,
  premiumStatus,
}: PremiumGateState): boolean => premiumLoading || premiumStatus === "unknown"

export const shouldEnforcePremiumLock = ({
  premiumLoading,
  premiumStatus,
}: PremiumGateState): boolean => !premiumLoading && premiumStatus === "free"

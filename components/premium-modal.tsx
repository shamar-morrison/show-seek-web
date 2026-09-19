"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Add01Icon,
  CheckmarkCircle02Icon,
  CrownIcon,
  Film02Icon,
  PlayCircle02Icon,
  Refresh01Icon,
  Ticket01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useAuth } from "@/context/auth-context"
import {
  beginPolarCheckout,
  isPremiumCheckoutBlocked,
} from "@/lib/polar-delete-guard"
import { useState } from "react"

interface PremiumModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Optional title override (defaults to the generic premium copy) */
  title?: string
  /** Optional description override (defaults to the generic premium copy) */
  description?: string
}

const MONTHLY_PRICE = "$3.99"
const YEARLY_PRICE = "$29.99"
const YEARLY_MONTHLY_EQUIVALENT = "$2.50"

const PREMIUM_BENEFITS = [
  {
    icon: PlayCircle02Icon,
    title: "Where to Watch for anything",
    description: "See where any movie or show is streaming right now.",
  },
  {
    icon: CheckmarkCircle02Icon,
    title: "Hide watched in Discover",
    description: "Automatically filter out what you've already seen.",
  },
  {
    icon: Film02Icon,
    title: "Latest trailers on Home",
    description: "An exclusive home screen row with new trailers.",
  },
  {
    icon: Refresh01Icon,
    title: "Trakt sync and imports",
    description: "Two-way Trakt syncing plus one-click IMDb imports.",
  },
]

export function PremiumModal({
  open,
  onOpenChange,
  title = "Unlock ShowSeek Premium",
  description = "Everything you need to track more, miss less, and keep your watchlist under control.",
}: PremiumModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("yearly")
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const {
    isPremium,
    premiumLoading,
    premiumProvider,
    premiumSubscriptionState,
  } = useAuth()
  const isCheckoutBlocked = isPremiumCheckoutBlocked({
    isPremium,
    premiumLoading,
    provider: premiumProvider,
    subscriptionState: premiumSubscriptionState,
  })
  const isBlockedForActivePremium = isCheckoutBlocked && !premiumLoading

  const handleSubscribe = () => {
    if (isCheckoutBlocked) {
      return
    }
    setCheckoutError(null)
    setIsRedirecting(true)
    try {
      beginPolarCheckout({
        plan: selectedPlan,
        blocked: isCheckoutBlocked,
        navigate: (url) => {
          window.location.href = url
        },
      })
    } catch {
      setIsRedirecting(false)
      setCheckoutError("Could not start checkout. Please try again.")
    }
  }

  const isMonthlySelected = selectedPlan === "monthly"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#121212] p-0 text-white sm:max-w-md">
        <div className="flex flex-col p-6 sm:p-7">
          <DialogHeader className="mb-5 text-left">
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold tracking-tight text-white">
              <HugeiconsIcon
                icon={CrownIcon}
                className="size-5 shrink-0 text-[#F2B33D]"
              />
              {title}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-[#A3A3A3]">
              {description}
            </DialogDescription>
          </DialogHeader>

          {/* What you get */}
          <ul className="divide-y divide-white/5">
            {PREMIUM_BENEFITS.map((benefit) => (
              <li key={benefit.title} className="flex items-start gap-3 py-2.5">
                <HugeiconsIcon
                  icon={benefit.icon}
                  className="mt-0.5 size-5 shrink-0 text-[#F2B33D]"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">
                    {benefit.title}
                  </p>
                  <p className="text-[13px] leading-snug text-[#A3A3A3]">
                    {benefit.description}
                  </p>
                </div>
              </li>
            ))}
            <li className="flex items-start gap-3 py-2.5">
              <HugeiconsIcon
                icon={Add01Icon}
                className="mt-0.5 size-5 shrink-0 text-[#F2B33D]"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">
                  Plus much more to unlock
                </p>
                <p className="text-[13px] leading-snug text-[#A3A3A3]">
                  New premium features are added regularly.
                </p>
              </div>
            </li>
          </ul>

          {/* Ticket perforation: separates what you get from what you pay */}
          <div className="relative my-4" aria-hidden="true">
            <div className="border-t border-dashed border-white/15" />
            <div className="absolute left-1/2 top-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#121212] ring-1 ring-white/15">
              <HugeiconsIcon
                icon={Ticket01Icon}
                className="size-3.5 text-[#F2B33D]"
              />
            </div>
          </div>

          {/* Plans */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSelectedPlan("monthly")}
              aria-pressed={isMonthlySelected}
              disabled={isCheckoutBlocked}
              className={`cursor-pointer rounded-2xl border p-4 text-left transition-colors ${
                isMonthlySelected
                  ? "border-[#F2B33D]/70 bg-[#F2B33D]/10"
                  : "border-white/10 bg-white/[0.03] hover:border-white/25"
              }`}
            >
              <p className="text-sm font-medium text-white">Monthly</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-white">
                {MONTHLY_PRICE}
                <span className="text-sm font-normal text-[#A3A3A3]">/mo</span>
              </p>
              <p className="mt-0.5 text-xs text-[#A3A3A3]">
                Billed month to month
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSelectedPlan("yearly")}
              aria-pressed={!isMonthlySelected}
              disabled={isCheckoutBlocked}
              className={`relative cursor-pointer rounded-2xl border p-4 text-left transition-colors ${
                !isMonthlySelected
                  ? "border-[#F2B33D]/70 bg-[#F2B33D]/10"
                  : "border-white/10 bg-white/[0.03] hover:border-white/25"
              }`}
            >
              <span className="absolute -top-2.5 right-3 rounded-full bg-[#F2B33D] px-2 py-0.5 text-[10px] font-semibold text-black">
                Best value
              </span>
              <p className="text-sm font-medium text-white">Annual</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-white">
                {YEARLY_PRICE}
                <span className="text-sm font-normal text-[#A3A3A3]">/yr</span>
              </p>
              <p className="mt-0.5 text-xs text-[#A3A3A3]">
                Just {YEARLY_MONTHLY_EQUIVALENT}/mo
              </p>
            </button>
          </div>

          {checkoutError ? (
            <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {checkoutError}
            </div>
          ) : null}

          {isBlockedForActivePremium ? (
            <p className="mt-3 text-center text-xs text-amber-200">
              You already have an active Premium subscription.
            </p>
          ) : null}

          <button
            type="button"
            disabled={isRedirecting || isCheckoutBlocked}
            onClick={handleSubscribe}
            className="mt-4 h-11 w-full cursor-pointer rounded-full bg-[#F2B33D] text-sm font-semibold text-black transition-colors hover:bg-[#f7c45c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRedirecting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                <span>Redirecting to Polar...</span>
              </span>
            ) : (
              <span>Upgrade to Premium</span>
            )}
          </button>

          <p className="mt-3 text-center text-xs text-[#A3A3A3]">
            Secure checkout powered by Polar. Cancel anytime.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

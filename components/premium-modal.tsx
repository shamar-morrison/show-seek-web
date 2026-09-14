"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CheckmarkCircle02Icon, CrownIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

interface PremiumModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Optional title override (defaults to the generic premium copy) */
  title?: string
  /** Optional description override (defaults to the generic premium copy) */
  description?: string
}

export function PremiumModal({
  open,
  onOpenChange,
  title = "Unlock ShowSeek Premium",
  description = "Get unlimited custom lists, advanced release calendar filters, Trakt syncing, and more.",
}: PremiumModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("yearly")
  const [isRedirecting, setIsRedirecting] = useState(false)

  const handleSubscribe = () => {
    setIsRedirecting(true)
    window.location.href = `/api/billing/polar/checkout?plan=${selectedPlan}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg border-amber-500/20 bg-[#121212] text-white">
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-amber-500/15 via-amber-500/5 to-transparent pointer-events-none" />

        <div className="relative flex flex-col items-center p-6 sm:p-8 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/40">
            <HugeiconsIcon icon={CrownIcon} className="size-7 text-amber-400" />
          </div>

          <DialogHeader className="mb-6 space-y-2 text-center">
            <DialogTitle className="text-2xl font-bold text-white tracking-tight">
              {title}
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base text-white/70 max-w-sm mx-auto">
              {description}
            </DialogDescription>
          </DialogHeader>

          {/* Plan Selector Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mb-6 text-left">
            {/* Monthly Option */}
            <button
              type="button"
              onClick={() => setSelectedPlan("monthly")}
              className={`relative flex flex-col justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                selectedPlan === "monthly"
                  ? "border-amber-500/60 bg-amber-500/10 ring-1 ring-amber-500/40"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-white">Monthly</span>
                  {selectedPlan === "monthly" && (
                    <HugeiconsIcon
                      icon={CheckmarkCircle02Icon}
                      className="size-4 text-amber-400"
                    />
                  )}
                </div>
                <p className="text-xs text-white/60 mb-3">
                  Flexible month-to-month billing
                </p>
              </div>
              <div className="text-lg font-bold text-white">
                Monthly Plan
              </div>
            </button>

            {/* Yearly Option */}
            <button
              type="button"
              onClick={() => setSelectedPlan("yearly")}
              className={`relative flex flex-col justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                selectedPlan === "yearly"
                  ? "border-amber-500/60 bg-amber-500/10 ring-1 ring-amber-500/40"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
              }`}
            >
              <div className="absolute -top-2.5 right-3 bg-gradient-to-r from-amber-500 to-amber-600 text-black text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                Best Value
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-white">Annual</span>
                  {selectedPlan === "yearly" && (
                    <HugeiconsIcon
                      icon={CheckmarkCircle02Icon}
                      className="size-4 text-amber-400"
                    />
                  )}
                </div>
                <p className="text-xs text-white/60 mb-3">
                  12 months of full premium access
                </p>
              </div>
              <div className="text-lg font-bold text-white">
                Yearly Plan
              </div>
            </button>
          </div>

          {/* Subscribe CTA Button */}
          <button
            type="button"
            disabled={isRedirecting}
            onClick={handleSubscribe}
            className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-black shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {isRedirecting ? (
              <>
                <div className="size-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                <span>Redirecting to Polar...</span>
              </>
            ) : (
              <>
                <span>Continue to Checkout</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-white/40 mt-4">
            Secure checkout powered by Polar. Cancel anytime from your account settings.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

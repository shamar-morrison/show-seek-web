"use client"

import { PremiumModal } from "@/components/premium-modal"
import { PremiumBadge } from "@/components/premium-badge"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { useState } from "react"

interface PreferenceToggleProps {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  premiumRequired?: boolean
  isPremium?: boolean
}

export function PreferenceToggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  premiumRequired = false,
  isPremium = false,
}: PreferenceToggleProps) {
  const [showPremiumModal, setShowPremiumModal] = useState(false)
  const isLocked = premiumRequired && !isPremium

  function handleChange(value: boolean) {
    if (isLocked) {
      setShowPremiumModal(true)
      return
    }
    onChange(value)
  }

  return (
    <>
      <label
        className={cn(
          "flex cursor-pointer items-center justify-between gap-4 rounded-lg px-4 py-3 transition-colors hover:bg-white/5",
          isLocked && "cursor-pointer opacity-60",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <div className="flex-1 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{label}</span>
            {premiumRequired && <PremiumBadge isPremium={isPremium} />}
          </div>
          <p className="text-sm text-white/60">{description}</p>
        </div>
        <Switch
          checked={checked}
          onCheckedChange={handleChange}
          disabled={disabled || isLocked}
        />
      </label>

      <PremiumModal
        open={showPremiumModal}
        onOpenChange={setShowPremiumModal}
      />
    </>
  )
}

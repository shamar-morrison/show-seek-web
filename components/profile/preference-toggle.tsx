"use client"

import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { CrownIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useRouter } from "next/navigation"

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
  const router = useRouter()
  const isLocked = premiumRequired && !isPremium

  function handleChange(value: boolean) {
    if (isLocked) {
      router.push("/premium")
      return
    }
    onChange(value)
  }

  return (
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
          {premiumRequired && (
            <span
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                isPremium
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-white/10 text-white/60",
              )}
            >
              <HugeiconsIcon icon={CrownIcon} className="size-3" />
              Premium
            </span>
          )}
        </div>
        <p className="text-sm text-white/60">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={handleChange}
        disabled={disabled || isLocked}
      />
    </label>
  )
}

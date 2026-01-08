"use client"

import { PremiumBadge } from "@/components/premium-badge"
import { cn } from "@/lib/utils"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, IconSvgElement } from "@hugeicons/react"
import { forwardRef } from "react"

interface ActionButtonProps {
  icon: IconSvgElement
  label: string
  onClick?: () => void
  badge?: string
  variant?: "default" | "danger"
  premiumRequired?: boolean
  isPremium?: boolean
  disabled?: boolean
  showChevron?: boolean
}

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  (
    {
      icon,
      label,
      onClick,
      badge,
      variant = "default",
      premiumRequired = false,
      isPremium = false,
      disabled = false,
      showChevron = true,
    },
    ref,
  ) => {
    const isLocked = premiumRequired && !isPremium

    return (
      <button
        ref={ref}
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors",
          "hover:bg-white/5 disabled:pointer-events-none disabled:opacity-50",
          variant === "danger" && "text-red-400 hover:bg-red-500/10",
        )}
      >
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-lg",
            variant === "default" ? "bg-white/10" : "bg-red-500/20",
          )}
        >
          <HugeiconsIcon
            icon={icon}
            className={cn(
              "size-5",
              variant === "default" ? "text-white" : "text-red-400",
            )}
          />
        </div>
        <div className="flex-1">
          <span
            className={cn(
              "text-sm font-medium",
              variant === "default" ? "text-white" : "text-red-400",
            )}
          >
            {label}
          </span>
        </div>
        {badge && (
          <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
            {badge}
          </span>
        )}
        {isLocked && <PremiumBadge isPremium={false} />}
        {showChevron && (
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            className="size-5 text-white/40"
          />
        )}
      </button>
    )
  },
)

ActionButton.displayName = "ActionButton"

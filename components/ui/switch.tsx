"use client"

import { cn } from "@/lib/utils"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { forwardRef } from "react"

interface SwitchProps {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  name?: string
  className?: string
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      checked,
      defaultChecked,
      onCheckedChange,
      disabled = false,
      name,
      className,
    },
    ref,
  ) => {
    return (
      <SwitchPrimitive.Root
        ref={ref}
        checked={checked}
        defaultChecked={defaultChecked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        name={name}
        className={cn(
          "group relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
          "bg-white/10 data-[checked]:bg-primary",
          "focus-visible:ring-primary focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            "pointer-events-none block size-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
            "translate-x-0.5 data-[checked]:translate-x-[1.375rem]",
          )}
        />
      </SwitchPrimitive.Root>
    )
  },
)

Switch.displayName = "Switch"

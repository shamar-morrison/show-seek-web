"use client"

import { cn } from "@/lib/utils"
import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox"
import { Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

interface CheckboxProps {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  className?: string
}

export function Checkbox({
  checked,
  onCheckedChange,
  className,
}: CheckboxProps) {
  return (
    <BaseCheckbox.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={cn(
        "size-5 shrink-0 rounded border border-white/20 bg-white/5 transition-colors",
        "data-checked:border-primary data-checked:bg-primary",
        "focus:outline-none focus:ring-2 focus:ring-primary/20",
        className,
      )}
    >
      <BaseCheckbox.Indicator className="flex items-center justify-center text-white">
        <HugeiconsIcon icon={Tick02Icon} className="size-3.5" strokeWidth={3} />
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  )
}

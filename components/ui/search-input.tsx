"use client"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

interface SearchInputProps {
  /** The current search query value */
  value: string
  /** Callback when the search query changes */
  onChange: (value: string) => void
  /** Placeholder text */
  placeholder?: string
  /** Optional unique ID for the input */
  id?: string
  /** Additional className for the container */
  className?: string
}

/**
 * SearchInput Component
 * Reusable search input with consistent styling across the app
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  id,
  className,
}: SearchInputProps) {
  return (
    <div className={cn("relative max-w-2xl", className)}>
      <HugeiconsIcon
        icon={Search01Icon}
        className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-gray-400"
      />
      <Input
        id={id}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 rounded-xl border-white/10 bg-white/5 pl-12 pr-4 text-lg text-white placeholder:text-gray-500 focus:border-primary/50 focus:ring-primary/20"
      />
    </div>
  )
}

"use client"

import { cn } from "@/lib/utils"
import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import * as React from "react"
import { Command, CommandGroup, CommandItem, CommandList } from "./command"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

export interface FilterOption {
  label: string
  value: string
}

interface FilterSelectProps {
  /** Label for the select */
  label?: string
  /** Currently selected value */
  value: string | null
  /** Available options */
  options: FilterOption[]
  /** Callback when selection changes */
  onChange: (value: string | null) => void
  /** Placeholder text when no selection */
  placeholder?: string
  /** Whether the select is disabled */
  disabled?: boolean
}

/**
 * Filter Select using ShadCN pattern (Popover + Command).
 * Similar to Combobox but without search input (for smaller option lists).
 */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Select...",
  disabled = false,
}: FilterSelectProps) {
  const [open, setOpen] = React.useState(false)

  // Find selected option for display
  const selectedOption = value
    ? options.find((opt) => opt.value === value)
    : null

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-gray-400">{label}</label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={disabled}
          className={cn(
            "flex w-44 items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors",
            "hover:border-white/20 hover:bg-white/10 hover:text-white",
            "focus:border-primary focus:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <span className={cn("truncate", !selectedOption && "text-gray-500")}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            className={cn(
              "size-4 shrink-0 text-gray-400 transition-transform",
              open && "rotate-180",
            )}
          />
        </PopoverTrigger>
        <PopoverContent className="w-[--trigger-width] p-0" align="start">
          <Command>
            <CommandList>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      onChange(option.value === value ? null : option.value)
                      setOpen(false)
                    }}
                    className="px-3 py-2.5"
                  >
                    {option.label}
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      className={cn(
                        "ml-auto size-4",
                        value === option.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

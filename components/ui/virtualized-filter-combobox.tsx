"use client"

import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { cn } from "@/lib/utils"
import {
  ArrowDown01Icon,
  Search01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useVirtualizer } from "@tanstack/react-virtual"
import * as React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

export interface ComboboxOption {
  label: string
  value: string
}

interface VirtualizedFilterComboboxProps {
  /** Label for the combobox */
  label?: string
  /** Currently selected value */
  value?: string | null
  /** Available options */
  options: ComboboxOption[]
  /** Callback when selection changes */
  onChange?: (value: string | null) => void
  /** Placeholder text */
  placeholder?: string
  /** Search placeholder */
  searchPlaceholder?: string
  /** Empty message when no results */
  emptyMessage?: string
  /** Whether the combobox is disabled */
  disabled?: boolean
  /** Height of each item for virtualization (default: 40) */
  itemHeight?: number
  /** Search debounce delay in ms (default: 150) */
  debounceDelay?: number
  /** Additional class for the trigger button (useful for width customization) */
  triggerClassName?: string
  /** Additional class for the popover content (useful for dropdown width) */
  popoverClassName?: string
}

/**
 * Virtualized Filter Combobox for large option lists.
 * Uses @tanstack/react-virtual to only render visible items.
 * Includes debounced search for performance.
 */
export function VirtualizedFilterCombobox({
  label,
  value,
  options,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  disabled = false,
  itemHeight = 40,
  debounceDelay = 150,
  triggerClassName,
  popoverClassName,
}: VirtualizedFilterComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")
  const debouncedSearch = useDebouncedValue(searchValue, debounceDelay)

  // Use state for the scroll container to trigger re-render when it mounts
  const [scrollContainer, setScrollContainer] =
    React.useState<HTMLDivElement | null>(null)

  // Callback ref to capture the scroll container when it mounts
  const scrollContainerRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (node !== null) {
        setScrollContainer(node)
      }
    },
    [],
  )

  // Filter options based on debounced search value
  const filteredOptions = React.useMemo(() => {
    if (!debouncedSearch) return options
    const search = debouncedSearch.toLowerCase()
    return options.filter((opt) => opt.label.toLowerCase().includes(search))
  }, [options, debouncedSearch])

  const estimateSize = React.useCallback(() => itemHeight, [itemHeight])

  const getScrollElement = React.useCallback(
    () => scrollContainer,
    [scrollContainer],
  )

  const virtualizerOptions = React.useMemo(
    () => ({
      count: filteredOptions.length,
      getScrollElement,
      estimateSize,
      overscan: 5,
    }),
    [filteredOptions.length, getScrollElement, estimateSize],
  )

  const virtualizer = useVirtualizer(virtualizerOptions)

  const selectedOption = value
    ? options.find((opt) => opt.value === value)
    : null

  const handleSelect = React.useCallback(
    (option: ComboboxOption) => {
      onChange?.(option.value === value ? null : option.value)
      setOpen(false)
      setSearchValue("")
    },
    [onChange, value],
  )

  // Reset state when closing and re-measure when opening
  React.useEffect(() => {
    if (!open) {
      setSearchValue("")
      setScrollContainer(null) // Reset so virtualizer reinitializes on next open
    } else if (scrollContainer) {
      // Force re-measure when popover opens and container is ready
      virtualizer.measure()
    }
    // Note: virtualizer.measure is stable, but we include virtualizerOptions
    // to ensure measure is called when options change
  }, [open, scrollContainer, virtualizerOptions, virtualizer])

  // Scroll to selected item when opening
  React.useEffect(() => {
    if (open && value) {
      const index = filteredOptions.findIndex((opt) => opt.value === value)
      if (index !== -1) {
        // Small delay to ensure virtualizer has measured
        setTimeout(() => {
          virtualizer.scrollToIndex(index, { align: "center" })
        }, 0)
      }
    }
    // Note: virtualizer.scrollToIndex is stable, using virtualizerOptions for stability
  }, [open, value, filteredOptions, virtualizerOptions, virtualizer])

  // Calculate the list height - show up to 8 items, then scroll
  const maxVisibleItems = 8
  const listHeight = Math.min(
    filteredOptions.length * itemHeight,
    maxVisibleItems * itemHeight,
  )

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
            triggerClassName,
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
        <PopoverContent
          className={cn("w-[--trigger-width] p-0", popoverClassName)}
          align="start"
        >
          <div className="flex flex-col overflow-hidden rounded-md bg-popover text-popover-foreground">
            {/* Search input */}
            <div className="flex items-center border-b px-3">
              <HugeiconsIcon
                icon={Search01Icon}
                className="mr-2 size-4 shrink-0 opacity-50"
              />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder={searchPlaceholder}
                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Virtualized list */}
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              <div
                ref={scrollContainerRef}
                style={{ height: listHeight, maxHeight: 300 }}
                className="overflow-y-auto overflow-x-hidden p-2"
              >
                <div
                  style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                  }}
                >
                  {virtualizer.getVirtualItems().map((virtualItem) => {
                    const option = filteredOptions[virtualItem.index]
                    const isSelected = value === option.value

                    return (
                      <div
                        key={option.value}
                        data-index={virtualItem.index}
                        ref={virtualizer.measureElement}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          transform: `translateY(${virtualItem.start}px)`,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelect(option)}
                          className={cn(
                            "relative flex w-full cursor-default select-none items-center gap-2 rounded-md px-3 py-2.5 text-sm outline-none",
                            "hover:bg-accent hover:text-accent-foreground",
                            isSelected && "bg-accent/50",
                          )}
                        >
                          {option.label}
                          <HugeiconsIcon
                            icon={Tick02Icon}
                            className={cn(
                              "ml-auto size-4",
                              isSelected ? "opacity-100" : "opacity-0",
                            )}
                          />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

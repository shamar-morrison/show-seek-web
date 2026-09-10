"use client"

import { cn } from "@/lib/utils"
import {
  ArrowDown01Icon,
  Cancel01Icon,
  Search01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import * as React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

/** AND/OR combination operator for multi-select filters (mobile parity). */
export type MultiSelectOperator = "and" | "or"

export interface MultiSelectFilterOption {
  label: string
  value: string
}

interface MultiSelectFilterComboboxProps {
  /** Label rendered above the trigger */
  label?: React.ReactNode
  /** Available options */
  options: MultiSelectFilterOption[]
  /** Currently committed selection */
  selectedValues: string[]
  /**
   * Called once when the user confirms the staged selection via Apply.
   * Ticking checkboxes or switching AND/OR only updates the staged draft,
   * so callers fire a single update (e.g. one discover request) per Apply.
   */
  onApply?: (values: string[], operator: MultiSelectOperator) => void
  /** Current AND/OR operator (genres only) */
  operator?: MultiSelectOperator
  /** Show the AND/OR toggle once the staged selection is non-empty (genres only) */
  showOperatorTabs?: boolean
  /** Placeholder text when nothing is selected */
  placeholder?: string
  /** Search placeholder */
  searchPlaceholder?: string
  /** Empty message when search has no results */
  emptyMessage?: string
  /** Whether the combobox is disabled */
  disabled?: boolean
  /** Additional class for the trigger button */
  triggerClassName?: string
  /** Additional class for the popover content */
  popoverClassName?: string
}

/**
 * Multi-select filter combobox with staged selection, search, and an optional
 * AND/OR combination toggle. Ports the mobile MultiSelectFilter behavior:
 * selection is staged in a draft and committed via Apply, so toggling options
 * doesn't refetch the discover query on every tap; closing the popover
 * without applying discards the draft. Genres support AND/OR (toggle visible
 * once the draft is non-empty), streaming providers are always OR (no toggle).
 */
export function MultiSelectFilterCombobox({
  label,
  options,
  selectedValues,
  onApply,
  operator = "or",
  showOperatorTabs = false,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  disabled = false,
  triggerClassName,
  popoverClassName,
}: MultiSelectFilterComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")
  const [draftValues, setDraftValues] = React.useState<string[]>(selectedValues)
  const [draftOperator, setDraftOperator] =
    React.useState<MultiSelectOperator>(operator)

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        // Snapshot the committed selection into the draft on every open.
        setDraftValues(selectedValues)
        setDraftOperator(operator)
        setSearchValue("")
      }
      setOpen(nextOpen)
    },
    [operator, selectedValues],
  )

  const draftSet = React.useMemo(() => new Set(draftValues), [draftValues])
  const selectedSet = React.useMemo(
    () => new Set(selectedValues),
    [selectedValues],
  )

  const filteredOptions = React.useMemo(() => {
    if (!searchValue.trim()) return options
    const search = searchValue.toLowerCase()
    return options.filter((opt) => opt.label.toLowerCase().includes(search))
  }, [options, searchValue])

  const triggerText = React.useMemo(() => {
    if (selectedValues.length === 0) return placeholder
    const names = options
      .filter((opt) => selectedSet.has(opt.value))
      .map((opt) => opt.label)
    if (names.length <= 2) return names.join(", ")
    return `${names.slice(0, 2).join(", ")} +${names.length - 2}`
  }, [options, placeholder, selectedSet, selectedValues.length])

  const toggleDraftValue = React.useCallback((value: string) => {
    setDraftValues((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value],
    )
  }, [])

  const clearDraft = React.useCallback(() => {
    setDraftValues([])
    setDraftOperator("or")
  }, [])

  const applyDraft = React.useCallback(() => {
    onApply?.(draftValues, draftOperator)
    setOpen(false)
  }, [draftOperator, draftValues, onApply])

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-gray-400">{label}</label>
      )}
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          disabled={disabled}
          className={cn(
            "flex w-44 items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors",
            "hover:border-white/20 hover:bg-white/10 hover:text-white",
            "focus:border-primary focus:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
            selectedValues.length > 0 && "border-primary/40",
            triggerClassName,
          )}
        >
          <span
            className={cn(
              "truncate",
              selectedValues.length === 0 && "text-gray-500",
            )}
          >
            {triggerText}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {selectedValues.length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                {selectedValues.length}
              </span>
            )}
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              className={cn(
                "size-4 text-gray-400 transition-transform",
                open && "rotate-180",
              )}
            />
          </span>
        </PopoverTrigger>
        <PopoverContent
          className={cn("w-[--trigger-width] p-0", popoverClassName)}
          align="start"
        >
          <div className="flex flex-col overflow-hidden rounded-md bg-popover text-popover-foreground">
            {showOperatorTabs && draftValues.length > 0 && (
              <div className="flex gap-1 border-b p-2">
                {(["and", "or"] as const).map((op) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => setDraftOperator(op)}
                    aria-pressed={draftOperator === op}
                    className={cn(
                      "flex-1 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors",
                      draftOperator === op
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    {op === "and" ? "AND" : "OR"}
                  </button>
                ))}
              </div>
            )}

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
              {searchValue.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSearchValue("")}
                  aria-label="Clear search"
                  className="shrink-0 opacity-50 hover:opacity-100"
                >
                  <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                </button>
              )}
            </div>

            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto overflow-x-hidden p-2">
                {filteredOptions.map((option) => {
                  const isSelected = draftSet.has(option.value)
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="checkbox"
                      aria-checked={isSelected}
                      aria-label={option.label}
                      onClick={() => toggleDraftValue(option.value)}
                      className={cn(
                        "relative flex w-full cursor-default select-none items-center gap-2 rounded-md px-3 py-2.5 text-sm outline-none",
                        "hover:bg-accent hover:text-accent-foreground",
                        isSelected && "bg-accent/50",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded border",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-white/20",
                        )}
                      >
                        {isSelected && (
                          <HugeiconsIcon icon={Tick02Icon} className="size-3" />
                        )}
                      </span>
                      <span className="truncate">{option.label}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {(draftValues.length > 0 || selectedValues.length > 0) && (
              <div className="flex items-center gap-2 border-t p-2">
                <button
                  type="button"
                  onClick={clearDraft}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
                  Clear
                </button>
                <button
                  type="button"
                  onClick={applyDraft}
                  className="flex-1 rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

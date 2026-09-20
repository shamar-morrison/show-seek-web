"use client"

import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import * as React from "react"

import { cn } from "@/lib/utils"

import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "./command"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip"

export interface SearchableSelectOption {
  label: string
  searchValue?: string
  value: string
}

function defaultOptionFilter<Option extends SearchableSelectOption>(
  option: Option,
  searchValue: string,
): boolean {
  const normalizedQuery = searchValue.trim().toLowerCase()

  if (!normalizedQuery) {
    return true
  }

  return (option.searchValue ?? option.label)
    .toLowerCase()
    .includes(normalizedQuery)
}

interface SearchableSelectProps<
  Option extends SearchableSelectOption = SearchableSelectOption,
> {
  /** Whether the control is disabled */
  disabled?: boolean
  /** Message shown when no options match the search query */
  emptyMessage?: string
  /**
   * Custom option matcher receiving the raw search input. When provided it
   * replaces the default trim + lowercase includes check (e.g. for
   * diacritic folding).
   */
  filterOption?: (option: Option, query: string) => boolean
  /** Callback when an option is selected */
  onChange: (value: string | null) => void
  /** Available options */
  options: Option[]
  /** Placeholder shown when no option is selected */
  placeholder?: string
  /** Additional class for the popover content */
  popoverClassName?: string
  /** Horizontal alignment of the popover to the trigger (default "start") */
  popoverAlign?: "start" | "center" | "end"
  /** Space maintained from the viewport edge for collision handling */
  popoverCollisionPadding?: number
  /** Render custom option content */
  renderOption?: (option: Option, isSelected: boolean) => React.ReactNode
  /** Render custom trigger content */
  renderTriggerContent?: (
    selectedOption: Option | null,
    placeholder: string,
    open: boolean,
  ) => React.ReactNode
  /**
   * Custom trigger element (additive, optional). When provided it replaces
   * the default trigger button and is composed with the popover and tooltip
   * via `render`, so `triggerTestId`, `triggerAriaLabel` and `disabled` are
   * still merged onto it. The caller owns the element's variant, size and
   * className; `triggerClassName`, `renderTriggerContent` and
   * `hideTriggerChevron` are ignored in that case.
   */
  trigger?: React.ReactElement
  /** Placeholder text for the search input */
  searchPlaceholder?: string
  /** Accessible label applied to the trigger button */
  triggerAriaLabel?: string
  /** Additional class for the trigger */
  triggerClassName?: string
  /** Test id applied to the trigger */
  triggerTestId?: string
  /** Tooltip text shown on the trigger; wrapped only when provided */
  triggerTooltip?: React.ReactNode
  /** Hide the trailing chevron icon (for icon-only triggers) */
  hideTriggerChevron?: boolean
  /** Currently selected value */
  value?: string | null
}

export function SearchableSelect<
  Option extends SearchableSelectOption = SearchableSelectOption,
>({
  disabled = false,
  emptyMessage = "No results found.",
  filterOption,
  onChange,
  options,
  placeholder = "Select...",
  popoverClassName,
  popoverAlign = "start",
  popoverCollisionPadding,
  renderOption,
  renderTriggerContent,
  trigger: triggerElement,
  searchPlaceholder = "Search...",
  triggerAriaLabel,
  triggerClassName,
  triggerTestId,
  triggerTooltip,
  hideTriggerChevron = false,
  value,
}: SearchableSelectProps<Option>) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  const selectedOption = React.useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  )

  const filteredOptions = React.useMemo(() => {
    const matches = filterOption ?? defaultOptionFilter
    return options.filter((option) => matches(option, searchValue))
  }, [filterOption, options, searchValue])

  React.useEffect(() => {
    if (!open) {
      setSearchValue("")
    }
  }, [open])

  const handleSelect = React.useCallback(
    (optionValue: string) => {
      if (optionValue !== value) {
        onChange(optionValue)
      }

      setOpen(false)
    },
    [onChange, value],
  )

  const trigger = triggerElement ? (
    <PopoverTrigger
      data-testid={triggerTestId}
      aria-label={triggerAriaLabel}
      disabled={disabled}
      render={triggerElement}
    />
  ) : (
    <PopoverTrigger
      data-testid={triggerTestId}
      aria-label={triggerAriaLabel}
      disabled={disabled}
      className={cn(
        "flex w-44 items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors",
        "hover:border-white/20 hover:bg-white/10 hover:text-white",
        "focus:border-primary focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        triggerClassName,
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {renderTriggerContent ? (
          renderTriggerContent(selectedOption, placeholder, open)
        ) : (
          <span
            className={cn(
              "truncate",
              !selectedOption && "text-muted-foreground",
            )}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        )}
      </span>
      {!hideTriggerChevron && (
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className={cn(
            "size-4 shrink-0 text-gray-400 transition-transform",
            open && "rotate-180",
          )}
        />
      )}
    </PopoverTrigger>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {triggerTooltip ? (
        <Tooltip>
          <TooltipTrigger render={trigger} />
          <TooltipContent>{triggerTooltip}</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <PopoverContent
        align={popoverAlign}
        collisionPadding={popoverCollisionPadding}
        className={cn("w-[--trigger-width] p-0", popoverClassName)}
      >
        <Command shouldFilter={false}>
          <CommandInput
            autoFocus
            value={searchValue}
            onValueChange={setSearchValue}
            placeholder={searchPlaceholder}
          />
          <CommandList className="max-h-[320px] p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              <CommandGroup className="p-1">
                {filteredOptions.map((option) => {
                  const isSelected = option.value === value

                  return (
                    <CommandItem
                      key={option.value}
                      value={option.searchValue ?? option.label}
                      onSelect={() => handleSelect(option.value)}
                      className="gap-2 px-2.5 py-2.5"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        {renderOption ? (
                          renderOption(option, isSelected)
                        ) : (
                          <span className="truncate">{option.label}</span>
                        )}
                      </span>
                      <HugeiconsIcon
                        icon={Tick02Icon}
                        className={cn(
                          "ml-auto size-4 shrink-0",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

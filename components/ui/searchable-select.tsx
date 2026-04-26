"use client"

import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import * as React from "react"

import { cn } from "@/lib/utils"

import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "./command"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

export interface SearchableSelectOption {
  label: string
  searchValue?: string
  value: string
}

interface SearchableSelectProps<
  Option extends SearchableSelectOption = SearchableSelectOption,
> {
  /** Whether the control is disabled */
  disabled?: boolean
  /** Message shown when no options match the search query */
  emptyMessage?: string
  /** Callback when an option is selected */
  onChange: (value: string | null) => void
  /** Available options */
  options: Option[]
  /** Placeholder shown when no option is selected */
  placeholder?: string
  /** Additional class for the popover content */
  popoverClassName?: string
  /** Render custom option content */
  renderOption?: (option: Option, isSelected: boolean) => React.ReactNode
  /** Render custom trigger content */
  renderTriggerContent?: (
    selectedOption: Option | null,
    placeholder: string,
    open: boolean,
  ) => React.ReactNode
  /** Placeholder text for the search input */
  searchPlaceholder?: string
  /** Additional class for the trigger */
  triggerClassName?: string
  /** Test id applied to the trigger */
  triggerTestId?: string
  /** Currently selected value */
  value?: string | null
}

export function SearchableSelect<
  Option extends SearchableSelectOption = SearchableSelectOption,
>({
  disabled = false,
  emptyMessage = "No results found.",
  onChange,
  options,
  placeholder = "Select...",
  popoverClassName,
  renderOption,
  renderTriggerContent,
  searchPlaceholder = "Search...",
  triggerClassName,
  triggerTestId,
  value,
}: SearchableSelectProps<Option>) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  const selectedOption = React.useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  )

  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = searchValue.trim().toLowerCase()

    if (!normalizedQuery) {
      return options
    }

    return options.filter((option) =>
      (option.searchValue ?? option.label).toLowerCase().includes(normalizedQuery),
    )
  }, [options, searchValue])

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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        data-testid={triggerTestId}
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
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className={cn(
            "size-4 shrink-0 text-gray-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
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

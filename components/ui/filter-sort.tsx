"use client"

import {
  ArrangeIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Calendar03Icon,
  Cancel01Icon,
  SortingIcon,
  StarIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon, IconSvgElement } from "@hugeicons/react"

import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu"
import { Slider } from "./slider"

// ============================================================================
// Type Definitions
// ============================================================================

/** A single option within a filter category */
export interface FilterOption {
  /** Value to be stored/compared */
  value: string
  /** Display label */
  label: string
}

/** A filter category with its options */
export interface FilterCategory {
  /** Unique key for this filter */
  key: string
  /** Display label for the category */
  label: string
  /** Optional icon */
  icon?: IconSvgElement
  /** Available options */
  options: FilterOption[]
}

/** A sort field option */
export interface SortField {
  /** Value to be stored */
  value: string
  /** Display label */
  label: string
  /** Optional icon */
  icon?: IconSvgElement
}

/** Sort direction */
export type SortDirection = "asc" | "desc"

/** Current filter state - maps category key to selected value */
export type FilterState = Record<string, string>

/** Current sort state */
export interface SortState {
  /** Selected sort field */
  field: string
  /** Sort direction */
  direction: SortDirection
}

/** Year range configuration */
export interface YearRangeConfig {
  /** Minimum year available */
  min: number
  /** Maximum year available */
  max: number
  /** Currently selected range [minYear, maxYear] */
  value: [number, number]
  /** Callback when range changes */
  onChange: (range: [number, number]) => void
}

/** Rating filter configuration */
export interface RatingFilterConfig {
  /** Currently selected minimum rating (0 = no filter, 5-9 = minimum) */
  value: number
  /** Callback when rating changes */
  onChange: (rating: number) => void
}

/** FilterSort component props */
export interface FilterSortProps {
  /** Filter categories configuration */
  filters: FilterCategory[]
  /** Current filter state */
  filterState: FilterState
  /** Callback when a filter value changes */
  onFilterChange: (key: string, value: string) => void

  /** Sort field options */
  sortFields: SortField[]
  /** Current sort state */
  sortState: SortState
  /** Callback when sort changes */
  onSortChange: (state: SortState) => void

  /** Optional year range filter */
  yearRange?: YearRangeConfig

  /** Optional minimum rating filter */
  ratingFilter?: RatingFilterConfig

  /** Optional callback to clear all filters and sort */
  onClearAll?: () => void

  /** Additional class for the dropdown content */
  className?: string
  /** Additional class for the trigger button */
  triggerClassName?: string
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Count active filters (values that are not "all" or empty)
 */
function countActiveFilters(
  filterState: FilterState,
  filters: FilterCategory[],
  yearRange?: YearRangeConfig,
  ratingFilter?: RatingFilterConfig,
): number {
  let count = filters.reduce((acc, category) => {
    const value = filterState[category.key]
    // Count as active if value exists and is not a default value ("all" or "0")
    if (value && value !== "all" && value !== "0") {
      return acc + 1
    }
    return acc
  }, 0)

  // Count year range as active if not at full range
  if (
    yearRange &&
    (yearRange.value[0] !== yearRange.min ||
      yearRange.value[1] !== yearRange.max)
  ) {
    count += 1
  }

  // Count rating filter as active if set
  if (ratingFilter && ratingFilter.value > 0) {
    count += 1
  }

  return count
}

// ============================================================================
// Sub-Components
// ============================================================================

function FilterSubmenu({
  category,
  value,
  onValueChange,
}: {
  category: FilterCategory
  value: string
  onValueChange: (value: string) => void
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        {category.icon && (
          <HugeiconsIcon icon={category.icon} className="size-4" />
        )}
        <span>{category.label}</span>
        {value && value !== "all" && value !== "0" && (
          <span className="ml-auto text-xs text-muted-foreground">
            {category.options.find((o) => o.value === value)?.label}
          </span>
        )}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {category.options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

function YearRangeSubmenu({ config }: { config: YearRangeConfig }) {
  const isActive =
    config.value[0] !== config.min || config.value[1] !== config.max

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <HugeiconsIcon icon={Calendar03Icon} className="size-4" />
        <span>Release Year</span>
        {isActive && (
          <span className="ml-auto text-xs text-muted-foreground">
            {config.value[0]} – {config.value[1]}
          </span>
        )}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-[200px] p-3">
        <div className="space-y-3">
          <div className="text-sm font-medium text-foreground">Year Range</div>
          <Slider
            value={config.value}
            onValueChange={(value) =>
              config.onChange(value as [number, number])
            }
            min={config.min}
            max={config.max}
            step={1}
            formatValue={(v) => String(v)}
          />
        </div>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

function RatingFilterSubmenu({ config }: { config: RatingFilterConfig }) {
  const ratingOptions = [
    { value: "0", label: "All Ratings" },
    { value: "9", label: "9+" },
    { value: "8", label: "8+" },
    { value: "7", label: "7+" },
    { value: "6", label: "6+" },
    { value: "5", label: "5+" },
  ]

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <HugeiconsIcon icon={StarIcon} className="size-4" />
        <span>Min Rating</span>
        {config.value > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {config.value}+
          </span>
        )}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup
          value={String(config.value)}
          onValueChange={(value) => config.onChange(parseInt(value))}
        >
          {ratingOptions.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

function SortSubmenu({
  sortFields,
  sortState,
  onSortChange,
}: {
  sortFields: SortField[]
  sortState: SortState
  onSortChange: (state: SortState) => void
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <HugeiconsIcon icon={SortingIcon} className="size-4" />
        <span>Sort By</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {sortFields.find((f) => f.value === sortState.field)?.label}
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {/* Sort field selection */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Sort By</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={sortState.field}
            onValueChange={(field) => onSortChange({ ...sortState, field })}
          >
            {sortFields.map((sortField) => (
              <DropdownMenuRadioItem
                key={sortField.value}
                value={sortField.value}
              >
                {sortField.icon && (
                  <HugeiconsIcon icon={sortField.icon} className="size-4" />
                )}
                {sortField.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Direction selection */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Direction</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={sortState.direction}
            onValueChange={(direction) =>
              onSortChange({
                ...sortState,
                direction: direction as SortDirection,
              })
            }
          >
            <DropdownMenuRadioItem value="asc">
              <HugeiconsIcon icon={ArrowUp01Icon} className="size-4" />
              Ascending
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="desc">
              <HugeiconsIcon icon={ArrowDown01Icon} className="size-4" />
              Descending
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function FilterSort({
  filters,
  filterState,
  onFilterChange,
  sortFields,
  sortState,
  onSortChange,
  yearRange,
  ratingFilter,
  onClearAll,
  className,
  triggerClassName,
}: FilterSortProps) {
  const activeFilterCount = countActiveFilters(
    filterState,
    filters,
    yearRange,
    ratingFilter,
  )
  const hasActiveFilters = activeFilterCount > 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex items-center gap-2 rounded-md px-3 py-2",
          "text-sm font-medium",
          "bg-white/5 hover:bg-white/10",
          "border border-white/10",
          "transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-primary/20",
          triggerClassName,
        )}
      >
        <HugeiconsIcon icon={ArrangeIcon} className="size-4" />
        {hasActiveFilters && (
          <span className="flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-medium rounded-full bg-primary text-primary-foreground">
            {activeFilterCount}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className={cn("min-w-[300px]", className)}
      >
        {/* Filter submenus */}
        {(filters.length > 0 || yearRange || ratingFilter) && (
          <DropdownMenuGroup>
            <DropdownMenuLabel>Filters</DropdownMenuLabel>

            {/* Standard filter categories */}
            {filters.map((category) => (
              <FilterSubmenu
                key={category.key}
                category={category}
                value={filterState[category.key] ?? "all"}
                onValueChange={(value) => onFilterChange(category.key, value)}
              />
            ))}

            {/* Year range filter */}
            {yearRange && <YearRangeSubmenu config={yearRange} />}

            {/* Rating filter */}
            {ratingFilter && <RatingFilterSubmenu config={ratingFilter} />}
          </DropdownMenuGroup>
        )}

        {/* Separator between filters and sort */}
        {(filters.length > 0 || yearRange || ratingFilter) &&
          sortFields.length > 0 && <DropdownMenuSeparator />}

        {/* Sort submenu */}
        {sortFields.length > 0 && (
          <SortSubmenu
            sortFields={sortFields}
            sortState={sortState}
            onSortChange={onSortChange}
          />
        )}

        {/* Clear all action */}
        {onClearAll && hasActiveFilters && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onClearAll} variant="destructive">
              <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
              <span>Clear All</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

"use client"

import {
  SlidersHorizontalIcon,
  ViewOffSlashIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { Switch } from "./ui/switch"

interface WatchProgressOptionsMenuProps {
  hideCompleted: boolean
  onHideCompletedChange: (checked: boolean) => void
}

/**
 * Standalone options dropdown for the Watch Progress page.
 * Hosts the "Hide completed series" toggle, which filters
 * ended + fully watched shows out of the Caught Up tab.
 */
export function WatchProgressOptionsMenu({
  hideCompleted,
  onHideCompletedChange,
}: WatchProgressOptionsMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger
        aria-label="View options"
        data-testid="watch-progress-options-button"
        className={cn(
          "relative inline-flex items-center gap-2 rounded-md px-2.5 py-2.5",
          "text-sm font-medium",
          "bg-white/5 hover:bg-white/10",
          "border border-white/10",
          "transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-primary/20",
        )}
      >
        <HugeiconsIcon icon={SlidersHorizontalIcon} className="size-4" />
        {hideCompleted && (
          <span
            data-testid="watch-progress-options-badge"
            className="absolute top-1 right-1 size-2 rounded-full bg-primary"
          />
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[300px]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Options</DropdownMenuLabel>
          {/* Plain div (not a menu item) so the menu stays open on toggle */}
          <div
            data-testid="watch-progress-hide-completed-row"
            role="presentation"
            onClick={(event) => {
              // Let the Switch itself handle clicks to avoid double-toggling
              if ((event.target as HTMLElement).closest("button")) return
              onHideCompletedChange(!hideCompleted)
            }}
            className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 outline-none select-none hover:bg-white/5"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/5">
              <HugeiconsIcon icon={ViewOffSlashIcon} className="size-4" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium">
                Hide completed series
              </span>
              <span className="block text-xs text-white/60">
                Hide ended shows you&apos;ve finished from Caught Up.
              </span>
            </span>
            <Switch
              checked={hideCompleted}
              onCheckedChange={onHideCompletedChange}
            />
          </div>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

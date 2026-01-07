"use client"

import { cn } from "@/lib/utils"
import { Popover } from "@base-ui/react/popover"
import { ArrowRight01Icon, MenuTwoLineIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

export interface DropdownMenuItem {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  onClick?: () => void
  disabled?: boolean
  destructive?: boolean
  subItems?: DropdownMenuItem[]
}

export interface MediaCardDropdownMenuProps {
  items: DropdownMenuItem[]
  /** Additional class for the trigger container (for positioning) */
  className?: string
  /** If true, trigger is always visible. If false, only visible on hover (requires parent to have `group` class) */
  alwaysVisible?: boolean
  /** Custom trigger icon component. Defaults to MenuTwoLineIcon */
  triggerIcon?: typeof MenuTwoLineIcon
}

interface MenuItemButtonProps {
  item: DropdownMenuItem
  onClose: () => void
}

function MenuItemButton({ item, onClose }: MenuItemButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (item.disabled) return
    item.onClick?.()
    onClose()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={item.disabled}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
        "hover:bg-white/10 focus-visible:bg-white/10 focus:outline-none",
        item.destructive
          ? "text-red-400 hover:text-red-300"
          : "text-white hover:text-white",
        item.disabled && "pointer-events-none opacity-50",
      )}
    >
      {item.icon && (
        <item.icon
          className={cn(
            "size-4 shrink-0",
            item.destructive ? "text-red-400" : "text-gray-400",
          )}
        />
      )}
      <span className="flex-1">{item.label}</span>
      {item.subItems && item.subItems.length > 0 && (
        <span className="text-gray-500">
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
        </span>
      )}
    </button>
  )
}

export function MediaCardDropdownMenu({
  items,
  className,
  alwaysVisible = false,
  triggerIcon = MenuTwoLineIcon,
}: MediaCardDropdownMenuProps) {
  const [open, setOpen] = useState(false)

  if (items.length === 0) return null

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={<button type="button" />}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((prev) => !prev)
        }}
        className={cn(
          "flex size-8 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm transition-all duration-200",
          "hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white/30",
          !alwaysVisible && "opacity-0 group-hover:opacity-100",
          open && "opacity-100",
          className,
        )}
        aria-label="More options"
      >
        <HugeiconsIcon icon={triggerIcon} className="size-4 text-white" />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={4}
          className="z-9999"
        >
          <Popover.Popup
            className={cn(
              "min-w-[180px] rounded-lg border border-white/10 bg-black/90 p-1 shadow-xl backdrop-blur-xl",
              "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            )}
          >
            <div
              role="menu"
              aria-orientation="vertical"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
            >
              {items.map((item, index) => (
                <div key={item.id}>
                  {/* Separator before destructive items if not first */}
                  {item.destructive && index > 0 && (
                    <div className="my-1 h-px bg-white/10" />
                  )}
                  <MenuItemButton item={item} onClose={() => setOpen(false)} />
                </div>
              ))}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

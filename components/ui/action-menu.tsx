"use client"

import { MoreVerticalIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, IconSvgElement } from "@hugeicons/react"
import * as React from "react"

import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu"

// ============================================================================
// Type Definitions
// ============================================================================

/** Base properties shared by most action items */
interface BaseAction {
  /** Unique identifier for the item */
  key: string
  /** Display text */
  label: string
  /** Optional Hugeicons icon component */
  icon?: IconSvgElement
  /** Keyboard shortcut display (e.g., "⌘K") */
  shortcut?: string
  /** Whether the item is disabled */
  disabled?: boolean
}

/** Standard clickable action */
export interface ActionItem extends BaseAction {
  type: "action"
  /** Visual variant */
  variant?: "default" | "destructive"
  /** Click handler */
  onClick: () => void
}

/** Checkbox action with toggle state */
export interface CheckboxItem extends BaseAction {
  type: "checkbox"
  /** Current checked state */
  checked: boolean
  /** Handler for check state changes */
  onCheckedChange: (checked: boolean) => void
}

/** Individual radio item within a radio group */
export interface RadioItem {
  /** Unique identifier */
  key: string
  /** Display text */
  label: string
  /** Value for this option */
  value: string
  /** Optional icon */
  icon?: IconSvgElement
  /** Whether the item is disabled */
  disabled?: boolean
}

/** Radio group containing mutually exclusive options */
export interface RadioGroupItem {
  type: "radio-group"
  /** Unique identifier */
  key: string
  /** Currently selected value */
  value: string
  /** Handler for value changes */
  onValueChange: (value: string) => void
  /** Radio options */
  items: RadioItem[]
}

/** Submenu containing nested actions */
export interface SubmenuItem {
  type: "submenu"
  /** Unique identifier */
  key: string
  /** Display text */
  label: string
  /** Optional icon */
  icon?: IconSvgElement
  /** Whether the submenu trigger is disabled */
  disabled?: boolean
  /** Nested menu items (supports all action types) */
  items: ActionMenuItem[]
}

/** Visual separator between groups */
export interface SeparatorItem {
  type: "separator"
  /** Unique identifier */
  key: string
}

/** Label/header for grouping items */
export interface LabelItem {
  type: "label"
  /** Unique identifier */
  key: string
  /** Display text */
  label: string
}

/** Union type for all menu item types */
export type ActionMenuItem =
  | ActionItem
  | CheckboxItem
  | RadioGroupItem
  | SubmenuItem
  | SeparatorItem
  | LabelItem

// ============================================================================
// Component Props
// ============================================================================

export interface ActionMenuProps {
  /** List of actions to render */
  items: ActionMenuItem[]
  /** Custom trigger element. If not provided, a default "more options" button is rendered */
  trigger?: React.ReactElement
  /** Horizontal alignment of the menu relative to the trigger */
  align?: "start" | "center" | "end"
  /** Side of the trigger to show the menu */
  side?: "top" | "right" | "bottom" | "left"
  /** Offset from the side */
  sideOffset?: number
  /** Offset from the alignment */
  alignOffset?: number
  /** Additional class name for the menu content */
  className?: string
  /** Additional class name for the default trigger button */
  triggerClassName?: string
}

// ============================================================================
// Default Trigger Component
// ============================================================================

function DefaultTrigger({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-md p-2",
        "text-muted-foreground hover:text-foreground",
        "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/20",
        "transition-colors",
        className,
      )}
      aria-label="More options"
      {...props}
    >
      <HugeiconsIcon icon={MoreVerticalIcon} className="size-5" />
    </button>
  )
}

// ============================================================================
// Item Renderers
// ============================================================================

function renderIcon(icon?: IconSvgElement) {
  if (!icon) return null
  return <HugeiconsIcon icon={icon} className="size-4" />
}

function renderActionItem(item: ActionItem) {
  return (
    <DropdownMenuItem
      key={item.key}
      variant={item.variant}
      disabled={item.disabled}
      onClick={item.onClick}
    >
      {renderIcon(item.icon)}
      <span>{item.label}</span>
      {item.shortcut && (
        <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>
      )}
    </DropdownMenuItem>
  )
}

function renderCheckboxItem(item: CheckboxItem) {
  return (
    <DropdownMenuCheckboxItem
      key={item.key}
      checked={item.checked}
      disabled={item.disabled}
      onCheckedChange={item.onCheckedChange}
    >
      {renderIcon(item.icon)}
      <span>{item.label}</span>
      {item.shortcut && (
        <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>
      )}
    </DropdownMenuCheckboxItem>
  )
}

function renderRadioGroupItem(item: RadioGroupItem) {
  return (
    <DropdownMenuRadioGroup
      key={item.key}
      value={item.value}
      onValueChange={item.onValueChange}
    >
      {item.items.map((radioItem) => (
        <DropdownMenuRadioItem
          key={radioItem.key}
          value={radioItem.value}
          disabled={radioItem.disabled}
        >
          {renderIcon(radioItem.icon)}
          <span>{radioItem.label}</span>
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  )
}

function renderSubmenuItem(item: SubmenuItem) {
  return (
    <DropdownMenuSub key={item.key}>
      <DropdownMenuSubTrigger disabled={item.disabled}>
        {renderIcon(item.icon)}
        <span>{item.label}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {item.items.map(renderMenuItem)}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

function renderSeparator(item: SeparatorItem) {
  return <DropdownMenuSeparator key={item.key} />
}

function renderLabel(item: LabelItem) {
  return <DropdownMenuLabel key={item.key}>{item.label}</DropdownMenuLabel>
}

function renderMenuItem(item: ActionMenuItem): React.ReactNode {
  switch (item.type) {
    case "action":
      return renderActionItem(item)
    case "checkbox":
      return renderCheckboxItem(item)
    case "radio-group":
      return renderRadioGroupItem(item)
    case "submenu":
      return renderSubmenuItem(item)
    case "separator":
      return renderSeparator(item)
    case "label":
      return renderLabel(item)
    default:
      return null
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function ActionMenu({
  items,
  trigger,
  align = "end",
  side = "bottom",
  sideOffset = 4,
  alignOffset = 0,
  className,
  triggerClassName,
}: ActionMenuProps) {
  return (
    <DropdownMenu>
      {trigger ? (
        <DropdownMenuTrigger render={trigger} />
      ) : (
        <DropdownMenuTrigger
          render={<DefaultTrigger className={triggerClassName} />}
        />
      )}
      <DropdownMenuContent
        align={align}
        side={side}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        className={cn("w-max", className)}
      >
        {items.map(renderMenuItem)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

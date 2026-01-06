"use client"

import { Avatar } from "@/components/ui/avatar"
import { useAuth } from "@/context/auth-context"
import { cn } from "@/lib/utils"
import { Menu } from "@base-ui/react/menu"
import { Logout03Icon, UserIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"

/**
 * Get first name from a display name
 */
function getFirstName(displayName: string | null): string {
  if (!displayName) return "User"
  return displayName.split(/\s+/)[0]
}

/**
 * UserMenu Component
 * Displays user avatar, first name, and dropdown with Profile/Logout options
 */
export function UserMenu() {
  const { user, signOut } = useAuth()

  if (!user) return null

  const firstName = getFirstName(user.displayName)

  return (
    <Menu.Root>
      <Menu.Trigger className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5">
        <Avatar
          src={user.photoURL}
          fallback={user.displayName || user.email || "U"}
          size="sm"
        />
        <span className="hidden text-sm font-medium text-gray-200 sm:block">
          {firstName}
        </span>
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner className="z-100" sideOffset={8} align="end">
          <Menu.Popup className="min-w-[160px] origin-(--transform-origin) rounded-lg border border-white/10 bg-[#1a1a1a] p-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-[opacity,transform] duration-200 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <Menu.Item
              render={<Link href="/profile" />}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-gray-300 outline-none transition-colors",
                "hover:bg-white/8 hover:text-white",
                "focus-visible:bg-white/8 focus-visible:text-white",
              )}
            >
              <HugeiconsIcon icon={UserIcon} className="size-4" />
              Profile
            </Menu.Item>

            <Menu.Separator className="my-1.5 h-px bg-white/10" />

            <Menu.Item
              onClick={signOut}
              className={cn(
                "flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm outline-none transition-colors text-primary",
                "hover:bg-white/8 hover:text-white",
                "focus-visible:bg-white/8 focus-visible:text-white",
              )}
            >
              <HugeiconsIcon icon={Logout03Icon} className="size-4" />
              Log out
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

"use client"

import { AuthModal } from "@/components/auth-modal"
import { SearchDropdown } from "@/components/search-dropdown"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { UserMenu } from "@/components/user-menu"
import { useAuth } from "@/context/auth-context"
import { SHOWSEEK_ICON } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { Collapsible } from "@base-ui/react/collapsible"
import { NavigationMenu } from "@base-ui/react/navigation-menu"
import {
  Cancel01Icon,
  Menu01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { default as Link, default as NextLink } from "next/link"
import { useEffect, useState } from "react"

/** Navigation item with sublinks */
interface NavItemWithSubmenu {
  label: string
  links: { label: string; href: string }[]
}

/** Simple navigation link */
interface SimpleNavItem {
  label: string
  href: string
}

/** Navigation menu data */
const listsMenu: NavItemWithSubmenu = {
  label: "Lists",
  links: [
    { label: "Watch Progress", href: "/lists/watch-progress" },
    { label: "Watch Lists", href: "/lists/watch-lists" },
    { label: "Custom Lists", href: "/lists/custom-lists" },
    { label: "Notes", href: "/lists/notes" },
  ],
}

const ratingsMenu: NavItemWithSubmenu = {
  label: "Ratings",
  links: [
    { label: "Episode Ratings", href: "/ratings/episodes" },
    { label: "Movie Ratings", href: "/ratings/movies" },
    { label: "TV Show Ratings", href: "/ratings/tv-shows" },
  ],
}

const favoritesMenu: NavItemWithSubmenu = {
  label: "Favorites",
  links: [
    { label: "Favorite Content", href: "/favorites/content" },
    { label: "Favorite People", href: "/favorites/people" },
  ],
}

const discoverLink: SimpleNavItem = {
  label: "Discover",
  href: "/discover",
}

/** Chevron icon for dropdown indicators */
function ChevronDownIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" {...props}>
      <path d="M1 3.5L5 7.5L9 3.5" stroke="currentcolor" strokeWidth="1.5" />
    </svg>
  )
}

/** Arrow SVG for the navigation menu popup */
function ArrowSvg(props: React.ComponentProps<"svg">) {
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none" {...props}>
      <path
        d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
        className="fill-[#1a1a1a]"
      />
      <path
        d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
        className="fill-[#1a1a1a]"
      />
      <path
        d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z"
        className="fill-white/10"
      />
    </svg>
  )
}

/** Custom link component that uses Next.js Link for client-side routing */
function NavLink(props: NavigationMenu.Link.Props) {
  return (
    <NavigationMenu.Link
      render={<NextLink href={props.href ?? ""} />}
      {...props}
    />
  )
}

/** Dropdown menu item component */
function DropdownMenuItem({ item }: { item: NavItemWithSubmenu }) {
  return (
    <NavigationMenu.Item>
      <NavigationMenu.Trigger className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-300 bg-transparent border-none rounded-md cursor-pointer transition-[background-color,color] duration-150 whitespace-nowrap no-underline hover:bg-white/5 hover:text-white data-popup-open:text-white">
        {item.label}
        <NavigationMenu.Icon className="flex transition-transform duration-200 data-popup-open:rotate-180">
          <ChevronDownIcon />
        </NavigationMenu.Icon>
      </NavigationMenu.Trigger>
      <NavigationMenu.Content className="p-2">
        <ul className="flex flex-col gap-0.5 list-none m-0 p-0 min-w-[180px]">
          {item.links.map((link) => (
            <li key={link.href}>
              <NavLink
                href={link.href}
                className="block px-3.5 py-2.5 text-sm font-medium text-gray-300 no-underline rounded-md transition-[background-color,color] duration-150 hover:bg-white/8 hover:text-white data-active:text-primary"
                closeOnClick
              >
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </NavigationMenu.Content>
    </NavigationMenu.Item>
  )
}

/** Mobile accordion menu item */
function MobileAccordionItem({
  item,
  onLinkClick,
}: {
  item: NavItemWithSubmenu
  onLinkClick: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
      <Collapsible.Trigger className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-gray-300 bg-transparent border-none rounded-lg cursor-pointer transition-[background-color,color] duration-150 text-left hover:bg-white/5 hover:text-white">
        <ChevronDownIcon
          className={cn(
            "transition-transform duration-200 ease-out",
            isOpen && "rotate-180",
          )}
        />
        {item.label}
      </Collapsible.Trigger>
      <Collapsible.Panel className="overflow-hidden transition-[height] duration-300 ease-out data-starting-style:h-0 data-ending-style:h-0 data-open:h-(--panel-height)">
        <div className="flex flex-col gap-0.5 pl-7 py-1">
          {item.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onLinkClick}
              className="block px-3 py-2 text-sm font-medium text-gray-400 no-underline rounded-md transition-[background-color,color] duration-150 hover:bg-white/5 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  )
}

/**
 * Navbar Component
 * Sticky navigation bar with logo, nav links, search, and sign-in button
 * Responsive with mobile hamburger menu
 * Animates from transparent to solid black on scroll
 */
export function Navbar() {
  const { user, loading } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const closeMobileMenu = () => setIsMobileMenuOpen(false)

  return (
    <nav
      className={cn(
        "fixed left-0 right-0 top-0 z-50 transition-all duration-300",
        isScrolled
          ? "border-b border-white/10 bg-black/95 backdrop-blur-md"
          : "border-b border-transparent bg-black/20 backdrop-blur-sm",
      )}
    >
      <div className="mx-auto max-w-[1800px] px-4 sm:px-8 lg:px-12">
        <div className="flex h-16 items-center justify-between">
          {/* Left Section - Logo */}
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="flex items-center gap-2 transition-opacity hover:opacity-80"
            >
              {/* Logo Icon */}
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <HugeiconsIcon
                  icon={SHOWSEEK_ICON}
                  className="size-5 text-white"
                />
              </div>
              <span className="text-xl font-bold text-white">ShowSeek</span>
            </Link>

            {/* Center Section - Navigation (Desktop) */}
            <NavigationMenu.Root className="hidden lg:block">
              <NavigationMenu.List className="flex items-center gap-1 list-none m-0 p-0">
                {/* Discover - Simple Link */}
                <NavigationMenu.Item>
                  <NavLink
                    href={discoverLink.href}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-300 bg-transparent border-none rounded-md cursor-pointer transition-[background-color,color] duration-150 whitespace-nowrap no-underline hover:bg-white/5 hover:text-white"
                  >
                    {discoverLink.label}
                  </NavLink>
                </NavigationMenu.Item>

                {/* Lists - Dropdown */}
                <DropdownMenuItem item={listsMenu} />

                {/* Ratings - Dropdown */}
                <DropdownMenuItem item={ratingsMenu} />

                {/* Favorites - Dropdown */}
                <DropdownMenuItem item={favoritesMenu} />
              </NavigationMenu.List>

              <NavigationMenu.Portal>
                <NavigationMenu.Positioner
                  className="z-100 outline-none"
                  sideOffset={10}
                  collisionPadding={{ top: 5, bottom: 5, left: 20, right: 20 }}
                >
                  <NavigationMenu.Popup className="bg-[#1a1a1a] border border-white/10 rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden origin-(--transform-origin) transition-[opacity,transform] duration-200 ease-out data-starting-style:opacity-0 data-starting-style:-translate-y-2 data-ending-style:opacity-0 data-ending-style:-translate-y-2 data-open:opacity-100 data-open:translate-y-0">
                    <NavigationMenu.Arrow className="flex items-center justify-center absolute -top-2.5 left-1/2 -translate-x-1/2 z-1">
                      <ArrowSvg />
                    </NavigationMenu.Arrow>
                    <NavigationMenu.Viewport className="relative" />
                  </NavigationMenu.Popup>
                </NavigationMenu.Positioner>
              </NavigationMenu.Portal>
            </NavigationMenu.Root>
          </div>

          {/* Right Section - Search & Auth */}
          <div className="flex items-center gap-3">
            {/* Search Bar (Desktop) */}
            <SearchDropdown className="hidden sm:block" />

            {/* Search Icon (Mobile) */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-gray-300 hover:bg-white/5 hover:text-white sm:hidden"
            >
              <HugeiconsIcon icon={Search01Icon} className="size-5" />
            </Button>

            {/* Auth Section - Sign In or User Menu */}
            {loading ? (
              <Skeleton className="h-9 w-[100px] rounded-lg" />
            ) : user ? (
              <UserMenu />
            ) : (
              <AuthModal />
            )}

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-gray-300 hover:bg-white/5 hover:text-white lg:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <HugeiconsIcon
                icon={isMobileMenuOpen ? Cancel01Icon : Menu01Icon}
                className="size-5"
              />
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out lg:hidden",
            isMobileMenuOpen ? "max-h-[500px] pb-4" : "max-h-0",
          )}
        >
          <div className="flex flex-col gap-1 pt-2">
            {/* Discover - Simple Link */}
            <Link
              href={discoverLink.href}
              onClick={closeMobileMenu}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              {discoverLink.label}
            </Link>

            {/* Lists - Accordion */}
            <MobileAccordionItem
              item={listsMenu}
              onLinkClick={closeMobileMenu}
            />

            {/* Ratings - Accordion */}
            <MobileAccordionItem
              item={ratingsMenu}
              onLinkClick={closeMobileMenu}
            />

            {/* Favorites - Accordion */}
            <MobileAccordionItem
              item={favoritesMenu}
              onLinkClick={closeMobileMenu}
            />
          </div>
        </div>
      </div>
    </nav>
  )
}

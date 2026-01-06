"use client"

import { SearchDropdown } from "@/components/search-dropdown"
import { Button } from "@/components/ui/button"
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
      <NavigationMenu.Trigger className="nav-menu-trigger">
        {item.label}
        <NavigationMenu.Icon className="nav-menu-icon">
          <ChevronDownIcon />
        </NavigationMenu.Icon>
      </NavigationMenu.Trigger>
      <NavigationMenu.Content className="nav-menu-content">
        <ul className="nav-menu-link-list">
          {item.links.map((link) => (
            <li key={link.href}>
              <NavLink href={link.href} className="nav-menu-link" closeOnClick>
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
      <Collapsible.Trigger className="mobile-nav-accordion-trigger">
        <ChevronDownIcon
          className={cn("mobile-nav-accordion-icon", isOpen && "rotate-180")}
        />
        {item.label}
      </Collapsible.Trigger>
      <Collapsible.Panel className="mobile-nav-accordion-panel">
        <div className="mobile-nav-accordion-content">
          {item.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onLinkClick}
              className="mobile-nav-sublink"
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
              <NavigationMenu.List className="nav-menu-list">
                {/* Discover - Simple Link */}
                <NavigationMenu.Item>
                  <NavLink
                    href={discoverLink.href}
                    className="nav-menu-trigger"
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
                  className="nav-menu-positioner"
                  sideOffset={10}
                  collisionPadding={{ top: 5, bottom: 5, left: 20, right: 20 }}
                >
                  <NavigationMenu.Popup className="nav-menu-popup">
                    <NavigationMenu.Arrow className="nav-menu-arrow">
                      <ArrowSvg />
                    </NavigationMenu.Arrow>
                    <NavigationMenu.Viewport className="nav-menu-viewport" />
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

            {/* Sign In Button */}
            <Button className="bg-primary px-5 font-semibold text-white transition-all hover:bg-[#B20710]">
              Sign In
            </Button>

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

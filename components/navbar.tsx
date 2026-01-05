"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  Search01Icon,
  Menu01Icon,
  Cancel01Icon,
  Home01Icon,
  Film01Icon,
  Tv01Icon,
  Compass01Icon,
  LibraryIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

/** Navigation menu item type */
interface NavItem {
  label: string
  href: string
  icon: typeof Home01Icon
}

/** Navigation menu items */
const navItems: NavItem[] = [
  { label: "Home", href: "/", icon: Home01Icon },
  { label: "Movies", href: "/movies", icon: Film01Icon },
  { label: "TV Shows", href: "/tv-shows", icon: Tv01Icon },
  { label: "Discover", href: "/discover", icon: Compass01Icon },
  { label: "Library", href: "/library", icon: LibraryIcon },
]

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
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E50914]">
                <HugeiconsIcon
                  icon={Film01Icon}
                  className="size-5 text-white"
                />
              </div>
              <span className="text-xl font-bold text-white">ShowSeek</span>
            </Link>

            {/* Center Section - Navigation (Desktop) */}
            <div className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    item.label === "Home"
                      ? "text-[#E50914]"
                      : "text-gray-300 hover:bg-white/5 hover:text-white",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Right Section - Search & Auth */}
          <div className="flex items-center gap-3">
            {/* Search Bar (Desktop) */}
            <div className="relative hidden sm:block">
              <HugeiconsIcon
                icon={Search01Icon}
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400"
              />
              <Input
                type="text"
                placeholder="Search..."
                className="h-9 w-48 rounded-full border-white/10 bg-white/5 pl-9 text-sm text-white placeholder:text-gray-500 focus:border-[#E50914]/50 focus:ring-[#E50914]/20 lg:w-64"
              />
            </div>

            {/* Search Icon (Mobile) */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-gray-300 hover:bg-white/5 hover:text-white sm:hidden"
            >
              <HugeiconsIcon icon={Search01Icon} className="size-5" />
            </Button>

            {/* Sign In Button */}
            <Button className="bg-[#E50914] px-5 font-semibold text-white transition-all hover:bg-[#B20710]">
              Sign In
            </Button>

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-gray-300 hover:bg-white/5 hover:text-white md:hidden"
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
            "overflow-hidden transition-all duration-300 ease-in-out md:hidden",
            isMobileMenuOpen ? "max-h-96 pb-4" : "max-h-0",
          )}
        >
          <div className="flex flex-col gap-1 pt-2">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  item.label === "Home"
                    ? "bg-[#E50914]/10 text-[#E50914]"
                    : "text-gray-300 hover:bg-white/5 hover:text-white",
                )}
              >
                <HugeiconsIcon icon={item.icon} className="size-5" />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}

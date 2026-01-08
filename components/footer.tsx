import { SHOWSEEK_ICON } from "@/lib/constants"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"

export function Footer() {
  return (
    <footer className="w-full border-t border-white/10 bg-background py-12 text-sm">
      <div className="mx-auto grid max-w-[1800px] grid-cols-1 gap-8 px-4 sm:px-8 md:grid-cols-4 lg:px-12">
        {/* Brand Column */}
        <div className="flex flex-col gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <HugeiconsIcon
                icon={SHOWSEEK_ICON}
                className="size-5 text-white"
              />
            </div>
            <span className="text-xl font-bold text-white">ShowSeek</span>
          </Link>
          <p className="max-w-xs text-gray-400">
            Discover, track, and share your favorite movies and TV shows.
          </p>
        </div>

        {/* Navigation Column */}
        <div className="flex flex-col gap-4">
          <h3 className="font-semibold text-white">Navigation</h3>
          <div className="flex flex-col gap-2">
            <Link
              href="/"
              className="text-gray-400 transition-colors hover:text-white"
            >
              Discover
            </Link>
            <Link
              href="/search"
              className="text-gray-400 transition-colors hover:text-white"
            >
              Search
            </Link>
          </div>
        </div>

        {/* Support Column */}
        <div className="flex flex-col gap-4">
          <h3 className="font-semibold text-white">Support</h3>
          <div className="flex flex-col gap-2">
            <Link
              target="_blank"
              href="https://privacy-policies-psi.vercel.app/show-seek/terms"
              className="text-gray-400 transition-colors hover:text-white"
            >
              Terms of Service
            </Link>
            <Link
              target="_blank"
              href="https://privacy-policies-psi.vercel.app/show-seek/privacy"
              className="text-gray-400 transition-colors hover:text-white"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

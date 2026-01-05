import { CastCard } from "@/components/cast-card"
import type { CastMember } from "@/types/tmdb"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"

interface CastRowProps {
  /** Section title */
  title: string
  /** Array of cast members to display */
  cast: CastMember[]
  /** Link to view all cast/crew */
  href: string
  /** Maximum number of cast to display (default: 15) */
  limit?: number
}

/**
 * CastRow Component
 * Horizontal scrollable row of cast cards with a "View all" link
 * Similar layout to MediaRow but for cast members
 */
export function CastRow({ title, cast, href, limit = 15 }: CastRowProps) {
  if (!cast || cast.length === 0) return null

  return (
    <section className="py-8">
      {/* Header */}
      <div className="mx-auto mb-4 flex max-w-[1800px] items-end justify-between px-4 sm:px-8 lg:px-12">
        <h2 className="text-xl font-bold text-white sm:text-2xl">{title}</h2>
        <Link
          href={href}
          className="group flex items-center gap-1 text-sm font-medium text-gray-400 transition-colors hover:text-white"
        >
          View all
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            className="size-4 transition-transform group-hover:translate-x-1"
          />
        </Link>
      </div>

      {/* Horizontal Scroll Container */}
      <div className="mx-auto max-w-[1800px] px-4 sm:px-8 lg:px-12">
        <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
          {cast.slice(0, limit).map((member, index) => (
            <CastCard key={member.id} cast={member} priority={index < 5} />
          ))}
        </div>
      </div>
    </section>
  )
}

import { CastCard } from "@/components/cast-card"
import { ScrollableRow } from "@/components/ui/scrollable-row"
import { Section } from "@/components/ui/section"
import { ViewAllLink } from "@/components/ui/view-all-link"
import type { CastMember } from "@/types/tmdb"

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
    <Section title={title} headerExtra={<ViewAllLink href={href} />}>
      <ScrollableRow className="pb-2">
        {cast.slice(0, limit).map((member, index) => (
          <CastCard
            key={`${member.id}-${member.character || member.order || index}`}
            cast={member}
            priority={index < 5}
          />
        ))}
      </ScrollableRow>
    </Section>
  )
}

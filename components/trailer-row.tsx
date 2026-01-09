"use client"

import { TrailerCard } from "@/components/trailer-card"
import { Section } from "@/components/ui/section"
import type { TrailerItem } from "@/lib/tmdb"

interface TrailerRowProps {
  title: string
  trailers: TrailerItem[]
}

export function TrailerRow({ title, trailers }: TrailerRowProps) {
  if (!trailers || trailers.length === 0) return null

  return (
    <Section title={title}>
      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 snap-x snap-mandatory">
        {trailers.map((trailer) => (
          <TrailerCard
            key={`${trailer.mediaType}-${trailer.id}`}
            trailer={trailer}
          />
        ))}
      </div>
    </Section>
  )
}

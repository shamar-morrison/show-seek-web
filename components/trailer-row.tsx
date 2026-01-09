"use client"

import { ScrollableRow } from "@/components/ui/scrollable-row"
import { Section } from "@/components/ui/section"
import { VideoCard } from "@/components/video-card"
import type { TrailerItem } from "@/lib/tmdb"

interface TrailerRowProps {
  title: string
  trailers: TrailerItem[]
}

export function TrailerRow({ title, trailers }: TrailerRowProps) {
  if (!trailers || trailers.length === 0) return null

  return (
    <Section title={title}>
      <ScrollableRow className="pb-2">
        {trailers.map((trailer) => (
          <VideoCard
            key={`${trailer.mediaType}-${trailer.id}`}
            videoKey={trailer.trailerKey}
            title={trailer.title}
            subtitle={trailer.mediaType === "movie" ? "Movie" : "TV Show"}
          />
        ))}
      </ScrollableRow>
    </Section>
  )
}

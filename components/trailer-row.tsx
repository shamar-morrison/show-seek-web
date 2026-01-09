"use client"

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
      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
        {trailers.map((trailer) => (
          <VideoCard
            key={`${trailer.mediaType}-${trailer.id}`}
            videoKey={trailer.trailerKey}
            title={trailer.title}
            subtitle={trailer.mediaType === "movie" ? "Movie" : "TV Show"}
          />
        ))}
      </div>
    </Section>
  )
}

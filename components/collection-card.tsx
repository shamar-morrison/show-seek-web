"use client"

import { Section } from "@/components/ui/section"
import type { TMDBCollectionDetails, TMDBCollectionInfo } from "@/types/tmdb"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"

interface CollectionCardProps {
  collection: TMDBCollectionInfo | TMDBCollectionDetails
}

/**
 * Card displaying the collection a movie belongs to
 */
export function CollectionCard({ collection }: CollectionCardProps) {
  if (!collection) return null

  return (
    <Section title="Collection">
      <Link
        href={`/collection/${collection.id}`}
        className="group relative block aspect-21/9 w-full overflow-hidden rounded-xl bg-card shadow-md sm:w-[400px] md:w-[500px]"
      >
        {/* Backdrop Image */}
        {collection.backdrop_path ? (
          <img
            src={`https://image.tmdb.org/t/p/w780${collection.backdrop_path}`}
            alt={collection.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-900 text-gray-500">
            No Background Image
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/90 to-transparent" />

        {/* Content */}
        <div className="absolute bottom-4 left-4 right-4">
          <h3 className="line-clamp-1 text-xl font-bold text-white sm:text-2xl">
            {collection.name}
          </h3>
          <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-white/80 transition-colors group-hover:text-primary">
            View Collection
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
          </div>
        </div>
      </Link>
    </Section>
  )
}

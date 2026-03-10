"use client"

import { ImageWithFallback } from "@/components/ui/image-with-fallback"
import { buildImageUrl } from "@/lib/tmdb"
import type { CollectionProgressItem } from "@/types/collection-tracking"
import Link from "next/link"

interface CollectionProgressCardProps {
  collection: CollectionProgressItem
}

export function CollectionProgressCard({
  collection,
}: CollectionProgressCardProps) {
  const backdropUrl = buildImageUrl(
    collection.backdropPath ?? collection.posterPath,
    "w780",
  )

  return (
    <Link
      href={`/collection/${collection.collectionId}`}
      className="group overflow-hidden rounded-xl border border-white/10 bg-card transition-colors hover:border-white/20 hover:bg-card/80"
    >
      <div className="relative h-32 overflow-hidden bg-gray-900">
        <ImageWithFallback
          src={backdropUrl}
          alt={collection.name}
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          imageClassName="transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/35 to-transparent" />
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-base font-semibold text-white">
            {collection.name}
          </h3>
          <span className="shrink-0 text-sm text-white/60">
            {collection.watchedCount}/{collection.totalMovies}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-white/60">Progress</span>
            <span className="font-medium text-primary">
              {collection.percentage}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(collection.percentage, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  )
}

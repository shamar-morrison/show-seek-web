"use client"

import { fetchCollection } from "@/app/actions"
import { CollectionCard } from "@/components/collection-card"
import { SectionSkeleton } from "@/components/ui/section-skeleton"
import { useIntersectionObserver } from "@/hooks/use-intersection-observer"
import type { TMDBCollectionDetails, TMDBCollectionInfo } from "@/types/tmdb"
import { useCallback, useState } from "react"
import { toast } from "sonner"

interface CollectionSectionProps {
  collectionId: number
}

/**
 * Lazily loads and displays the collection section
 */
export function CollectionSection({ collectionId }: CollectionSectionProps) {
  const [collection, setCollection] = useState<
    TMDBCollectionDetails | TMDBCollectionInfo | null
  >(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  const loadCollection = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await fetchCollection(collectionId)
      setCollection(data)
    } catch (error) {
      console.error("Failed to load collection:", error)
      toast.error("Failed to load collection")
    } finally {
      setIsLoading(false)
      setHasLoaded(true)
    }
  }, [collectionId])

  const { ref: sectionRef } =
    useIntersectionObserver<HTMLDivElement>(loadCollection)

  if (hasLoaded && !collection) return null

  return (
    <div ref={sectionRef as React.RefObject<HTMLDivElement>}>
      {isLoading || !hasLoaded ? (
        <SectionSkeleton
          count={1}
          cardWidth={500}
          cardHeight={215}
          withSectionWrapper
        />
      ) : (
        <CollectionCard collection={collection!} />
      )}
    </div>
  )
}

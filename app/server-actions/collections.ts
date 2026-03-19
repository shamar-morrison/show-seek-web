"use server"

import { mapWithConcurrencyLimit } from "@/lib/utils/concurrency"
import { getCollectionDetails } from "@/lib/tmdb"
import type { TMDBCollectionDetails } from "@/types/tmdb"

const COLLECTION_BATCH_CONCURRENCY = 3

export type CollectionArtworkData = Pick<
  TMDBCollectionDetails,
  "poster_path" | "backdrop_path"
>

/**
 * Fetch collection details
 */
export async function fetchCollection(collectionId: number) {
  return await getCollectionDetails(collectionId)
}

export async function fetchCollectionsBatch(
  collectionIds: number[],
): Promise<Array<CollectionArtworkData | null>> {
  if (collectionIds.length === 0) {
    return []
  }

  const uniqueCollectionIds: number[] = []
  const seenCollectionIds = new Set<number>()

  collectionIds.forEach((collectionId) => {
    if (seenCollectionIds.has(collectionId)) {
      return
    }

    seenCollectionIds.add(collectionId)
    uniqueCollectionIds.push(collectionId)
  })

  const artworkByCollectionId = new Map<number, CollectionArtworkData | null>()

  await mapWithConcurrencyLimit(
    uniqueCollectionIds,
    async (collectionId) => {
      try {
        const collection = await getCollectionDetails(collectionId)

        if (!collection) {
          artworkByCollectionId.set(collectionId, null)
          return
        }

        artworkByCollectionId.set(collectionId, {
          poster_path: collection.poster_path ?? null,
          backdrop_path: collection.backdrop_path ?? null,
        })
      } catch (error) {
        console.error(
          `Server Action: Failed to fetch collection ${collectionId} in batch`,
          error,
        )
        artworkByCollectionId.set(collectionId, null)
      }
    },
    COLLECTION_BATCH_CONCURRENCY,
  )

  return collectionIds.map(
    (collectionId) => artworkByCollectionId.get(collectionId) ?? null,
  )
}

import { CollectionPageClient } from "@/components/collection-page-client"
import { getCollectionDetails } from "@/lib/tmdb"
import { compareTmdbDateStrings } from "@/lib/tmdb-date"
import { Metadata } from "next"
import { notFound } from "next/navigation"

interface CollectionPageProps {
  params: Promise<{
    id: string
  }>
}

/**
 * Collection Detail Page
 * specific page for displaying collection details and parts
 */
export default async function CollectionPage({ params }: CollectionPageProps) {
  const { id } = await params
  const collectionId = parseInt(id, 10)

  if (isNaN(collectionId)) {
    notFound()
  }

  const collection = await getCollectionDetails(collectionId)

  if (!collection) {
    notFound()
  }

  // Sort parts by release date
  const sortedParts =
    collection.parts?.sort((a, b) => {
      if (!a.release_date) return 1
      if (!b.release_date) return -1
      return compareTmdbDateStrings(a.release_date, b.release_date)
    }) || []

  return <CollectionPageClient collection={{ ...collection, parts: sortedParts }} />
}

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({
  params,
}: CollectionPageProps): Promise<Metadata> {
  const { id } = await params
  const collectionId = parseInt(id, 10)

  if (isNaN(collectionId)) {
    return { title: "Collection Not Found | ShowSeek" }
  }

  const collection = await getCollectionDetails(collectionId)

  if (!collection) {
    return { title: "Collection Not Found | ShowSeek" }
  }

  const backdropUrl = collection.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${collection.backdrop_path}`
    : undefined

  return {
    title: `${collection.name} | ShowSeek`,
    description: collection.overview,
    openGraph: {
      title: collection.name,
      description: collection.overview || undefined,
      type: "website",
      ...(backdropUrl && {
        images: [
          {
            url: backdropUrl,
            width: 1280,
            height: 720,
            alt: collection.name,
          },
        ],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: collection.name,
      description: collection.overview || undefined,
      ...(backdropUrl && { images: [backdropUrl] }),
    },
  }
}

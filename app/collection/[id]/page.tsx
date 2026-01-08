import { CollectionMoviesGrid } from "@/components/collection-movies-grid"
import { getCollectionDetails } from "@/lib/tmdb"
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
      return (
        new Date(a.release_date).getTime() - new Date(b.release_date).getTime()
      )
    }) || []

  const backdropUrl = collection.backdrop_path
    ? `https://image.tmdb.org/t/p/original${collection.backdrop_path}`
    : null

  return (
    <main className="min-h-screen bg-black pb-20">
      {/* Hero Section */}
      <section className="relative w-full overflow-hidden">
        {/* Background Backdrop Image */}
        {backdropUrl && (
          <div className="absolute inset-0">
            <img
              src={backdropUrl}
              alt={collection.name}
              className="h-full w-full object-cover object-center opacity-60"
            />
          </div>
        )}

        {/* Gradient Overlays */}
        <div className="absolute inset-x-0 top-0 z-10 h-32 bg-linear-to-b from-black/70 to-transparent" />
        <div className="absolute inset-0 z-10 bg-linear-to-t from-black via-black/60 to-transparent" />
        <div className="absolute inset-0 z-10 bg-linear-to-r from-black/80 via-black/30 to-transparent" />

        {/* Content */}
        <div className="relative z-20 pb-16 pt-64">
          <div className="mx-auto w-full max-w-[1800px] px-4 sm:px-8 lg:px-12">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:gap-12">
              <div className="flex flex-1 flex-col gap-4 text-center lg:text-left">
                {/* Title */}
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                  {collection.name}
                </h1>

                {/* Overview */}
                {collection.overview && (
                  <p className="max-w-3xl text-base leading-relaxed text-gray-300 lg:text-left text-center">
                    {collection.overview}
                  </p>
                )}

                {/* Stats */}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                  <div className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur-sm">
                    {sortedParts.length}{" "}
                    {sortedParts.length === 1 ? "Movie" : "Movies"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Movies Grid */}
      <div className="mx-auto w-full max-w-[1800px] px-4 sm:px-8 lg:px-12">
        <h2 className="mb-6 text-2xl font-bold text-white">Movies</h2>
        <CollectionMoviesGrid movies={sortedParts} />
      </div>
    </main>
  )
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

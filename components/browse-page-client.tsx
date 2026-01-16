"use client"

import { fetchTrailerKey } from "@/app/actions"
import { MediaCard } from "@/components/media-card"
import { MediaCardWithActions } from "@/components/media-card-with-actions"
import { PageContainer } from "@/components/page-container"
import { TrailerModal } from "@/components/trailer-modal"
import { Pagination } from "@/components/ui/pagination"
import type { TMDBMedia } from "@/types/tmdb"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

interface BrowsePageClientProps {
  /** Page title */
  title: string
  /** Media items to display */
  items: TMDBMedia[]
  /** Current page number (1-indexed) */
  currentPage: number
  /** Total number of pages */
  totalPages: number
  /** Total number of results */
  totalResults: number
  /** Base URL for pagination (e.g., "/trending-movies") */
  baseUrl: string
  /** If true, shows dropdown actions on cards */
  showActions?: boolean
}

/**
 * BrowsePageClient Component
 * Shared client component for paginated media browse pages.
 * Displays a grid of media cards with server-side pagination.
 */
export function BrowsePageClient({
  title,
  items,
  currentPage,
  totalPages,
  totalResults,
  baseUrl,
  showActions = true,
}: BrowsePageClientProps) {
  const router = useRouter()
  const [isTrailerOpen, setIsTrailerOpen] = useState(false)
  const [activeTrailer, setActiveTrailer] = useState<{
    key: string
    title: string
  } | null>(null)
  const [loadingMediaId, setLoadingMediaId] = useState<string | null>(null)

  // Handle page change - update URL for server-side pagination
  const handlePageChange = (page: number) => {
    const url = page === 1 ? baseUrl : `${baseUrl}?page=${page}`
    router.push(url)
  }

  // Handle opening trailer for Media Cards (fetch on demand)
  const handleWatchTrailer = async (media: TMDBMedia) => {
    const title = media.title || media.name || "Trailer"
    const mediaType =
      (media.media_type as "movie" | "tv") || (media.title ? "movie" : "tv")
    const compositeKey = `${mediaType}-${media.id}`

    setLoadingMediaId(compositeKey)

    try {
      const key = await fetchTrailerKey(media.id, mediaType)

      if (key) {
        setActiveTrailer({
          key,
          title: title,
        })
        setIsTrailerOpen(true)
      } else {
        toast.error(`No trailer available for ${title}`)
        console.warn("No trailer found for", title)
      }
    } catch (error) {
      console.error("Error fetching trailer:", error)
    } finally {
      setLoadingMediaId(null)
    }
  }

  // Choose which card component to render
  const CardComponent = showActions ? MediaCardWithActions : MediaCard

  return (
    <main className="min-h-screen bg-black pb-16 pt-32">
      {/* Back button and title */}
      <PageContainer>
        <div className="mb-8 flex items-center gap-4">
          <Link
            href="/"
            className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Go back home"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" />
          </Link>
          <h1 className="text-2xl font-bold text-white md:text-3xl">{title}</h1>
        </div>
      </PageContainer>

      {/* Media Grid */}
      <div className="mx-auto max-w-[1800px] px-4 sm:px-8 lg:px-12">
        {items.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/5 text-gray-400">
            <p>No items found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
            {items.map((item) => (
              <CardComponent
                key={`${item.media_type}-${item.id}`}
                media={item}
                onWatchTrailer={handleWatchTrailer}
                isLoading={loadingMediaId === `${item.media_type}-${item.id}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="container mx-auto mt-12 px-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalResults={totalResults}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {/* Trailer Modal */}
      <TrailerModal
        videoKey={activeTrailer?.key || null}
        isOpen={isTrailerOpen}
        onClose={() => {
          setIsTrailerOpen(false)
          setActiveTrailer(null)
        }}
        title={activeTrailer?.title || "Trailer"}
      />
    </main>
  )
}

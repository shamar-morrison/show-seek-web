"use client"

import { fetchTrailerKey } from "@/app/actions"
import { MediaCardWithActions } from "@/components/media-card-with-actions"
import { TrailerModal } from "@/components/trailer-modal"
import { PhotoLightbox } from "@/components/photo-lightbox"
import { FilterTabButton } from "@/components/ui/filter-tab-button"
import { ScrollableRow } from "@/components/ui/scrollable-row"
import { ViewAllLink } from "@/components/ui/view-all-link"
import { usePreferences } from "@/hooks/use-preferences"
import { usePersonImages } from "@/hooks/use-tmdb-queries"
import { useUrlStateSync } from "@/hooks/use-url-state-sync"
import {
  buildPersonCredits,
  getPersonCreditTypeLabel,
  getPersonCreditTypeOrder,
  PERSON_CREDIT_PREVIEW_LIMIT,
  type PersonCreditType,
} from "@/lib/person-credits"
import { getDisplayMediaTitle } from "@/lib/media-title"
import { buildImageUrl } from "@/lib/tmdb"
import type { TMDBActionableMedia, TMDBLogo, TMDBPersonDetails } from "@/types/tmdb"
import { Film01Icon, Image01Icon, Tv01Icon } from "@hugeicons/core-free-icons"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

interface PersonContentProps {
  person: TMDBPersonDetails
}

const INITIAL_VISIBLE_PHOTOS = 30
const PHOTOS_PAGE_SIZE = 30

type PersonCreditSection = {
  key: PersonCreditType
  title: string
  href: string
  items: TMDBActionableMedia[]
}

function isPersonContentTab(
  value: string | null,
): value is "movie" | "tv" | "photos" {
  return value === "movie" || value === "tv" || value === "photos"
}

export function PersonContent({ person }: PersonContentProps) {
  const [urlState, setUrlState] = useUrlStateSync<{
    tab: "movie" | "tv" | "photos"
  }>({
    keys: ["tab"],
    parse: (params) => {
      const tab = params.get("tab")

      return {
        tab: isPersonContentTab(tab) ? tab : "movie",
      }
    },
    serialize: (state) => {
      const params = new URLSearchParams()

      if (state.tab !== "movie") {
        params.set("tab", state.tab)
      }

      return params
    },
  })
  const activeTab = urlState.tab
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [trailerKey, setTrailerKey] = useState<string | null>(null)
  const [selectedTrailerMedia, setSelectedTrailerMedia] =
    useState<TMDBActionableMedia | null>(null)
  const [loadingMediaId, setLoadingMediaId] = useState<number | null>(null)
  const { preferences } = usePreferences()

  const {
    data: fetchedPhotos = [],
    isLoading: isPhotosLoading,
    isFetched: isPhotosFetched,
  } = usePersonImages(person.id, activeTab === "photos")

  const photos: TMDBLogo[] = useMemo(() => {
    if (fetchedPhotos.length > 0) return fetchedPhotos
    if (person.profile_path) {
      return [
        {
          file_path: person.profile_path,
          aspect_ratio: 0.667,
          height: 1500,
          width: 1000,
          iso_639_1: null,
          vote_average: 0,
          vote_count: 0,
        },
      ]
    }
    return []
  }, [fetchedPhotos, person.profile_path])

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_PHOTOS)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_PHOTOS)
  }, [person.id, activeTab])

  const hasMorePhotos = visibleCount < photos.length
  const visiblePhotos = hasMorePhotos
    ? photos.slice(0, visibleCount)
    : photos

  useEffect(() => {
    if (!hasMorePhotos || activeTab !== "photos") return
    const node = sentinelRef.current
    if (!node) return

    const total = photos.length
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount((count) => Math.min(count + PHOTOS_PAGE_SIZE, total))
        }
      },
      { rootMargin: "600px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMorePhotos, photos.length, activeTab])

  const creditsByTab = useMemo(() => buildPersonCredits(person), [person])

  const currentTabCredits =
    activeTab === "photos" ? null : creditsByTab[activeTab]
  const allSections: PersonCreditSection[] = currentTabCredits
    ? getPersonCreditTypeOrder(person.known_for_department).map(
        (creditType) => ({
          key: creditType,
          title: `${getPersonCreditTypeLabel(creditType)} (${currentTabCredits[creditType].length})`,
          href: `/person/${person.id}/credits?mediaType=${activeTab}&creditType=${creditType}`,
          items: currentTabCredits[creditType],
        }),
      )
    : []
  const sections = allSections.filter((section) => section.items.length > 0)

  const handleWatchTrailer = async (media: TMDBActionableMedia) => {
    setLoadingMediaId(media.id)
    try {
      const key = await fetchTrailerKey(media.id, media.media_type)
      if (key) {
        setTrailerKey(key)
        setSelectedTrailerMedia(media)
        setIsModalOpen(true)
      } else {
        toast.error("No trailer available for this title")
      }
    } catch {
      toast.error("Failed to load trailer")
    } finally {
      setLoadingMediaId(null)
    }
  }

  return (
    <div className="mt-8">
      {/* Tabs */}
      <div className="mb-8 flex flex-wrap gap-2 border-b border-white/10 pb-4">
        <FilterTabButton
          label="Movies"
          count={creditsByTab.movie.count}
          isActive={activeTab === "movie"}
          icon={Film01Icon}
          onClick={() => setUrlState({ tab: "movie" })}
        />
        <FilterTabButton
          label="TV Shows"
          count={creditsByTab.tv.count}
          isActive={activeTab === "tv"}
          icon={Tv01Icon}
          onClick={() => setUrlState({ tab: "tv" })}
        />
        <FilterTabButton
          label="Photos"
          count={isPhotosFetched ? photos.length : undefined}
          isActive={activeTab === "photos"}
          icon={Image01Icon}
          onClick={() => setUrlState({ tab: "photos" })}
        />
      </div>

      {activeTab === "photos" ? (
        isPhotosLoading ? (
          <div
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            data-testid="photos-loading-skeleton"
          >
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="aspect-2/3 w-full animate-pulse rounded-lg bg-white/5"
              />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            No photos found for {person.name}.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {visiblePhotos.map((photo, index) => {
                const imageUrl = buildImageUrl(photo.file_path, "w500")
                if (!imageUrl) return null

                return (
                  <button
                    key={`${photo.file_path}-${index}`}
                    type="button"
                    onClick={() => setLightboxIndex(index)}
                    className="group relative aspect-2/3 w-full overflow-hidden rounded-lg bg-gray-900 transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={`View photo ${index + 1}`}
                  >
                    <img
                      src={imageUrl}
                      alt={`${person.name} photo ${index + 1}`}
                      className="h-full w-full object-cover transition-opacity duration-300"
                      loading="lazy"
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                    />
                    <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
                  </button>
                )
              })}
            </div>
            {hasMorePhotos && (
              <div
                ref={sentinelRef}
                className="flex items-center justify-center gap-3 py-6 text-sm text-gray-400"
                data-testid="photos-load-more-sentinel"
              >
                <span
                  className="size-4 animate-spin rounded-full border-2 border-white/20 border-t-white/80"
                  aria-hidden="true"
                />
                Showing {visiblePhotos.length} of {photos.length} — loading
                more…
              </div>
            )}
          </div>
        )
      ) : sections.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          No {activeTab === "movie" ? "movies" : "TV shows"} found.
        </div>
      ) : (
        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section.key}>
              <div className="mb-6 flex items-end justify-between gap-4">
                <h2 className="text-xl font-bold text-white">{section.title}</h2>
                <ViewAllLink href={section.href} />
              </div>
              <ScrollableRow className="pb-2">
                {section.items
                  .slice(0, PERSON_CREDIT_PREVIEW_LIMIT)
                  .map((media) => (
                    <div
                      key={`${section.key}-${media.media_type}-${media.id}`}
                      className="w-[140px] shrink-0 sm:w-[160px]"
                    >
                      <MediaCardWithActions
                        media={media}
                        buttonText="Trailer"
                        onWatchTrailer={handleWatchTrailer}
                        isLoading={loadingMediaId === media.id}
                        preferOriginalTitles={preferences.showOriginalTitles}
                      />
                    </div>
                  ))}
              </ScrollableRow>
            </section>
          ))}
        </div>
      )}

      <PhotoLightbox
        images={photos}
        currentIndex={lightboxIndex ?? 0}
        isOpen={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
      />

      <TrailerModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedTrailerMedia(null)
        }}
        videoKey={trailerKey}
        title={
          (selectedTrailerMedia &&
            getDisplayMediaTitle(
              selectedTrailerMedia,
              preferences.showOriginalTitles,
            )) ||
          "Trailer"
        }
      />
    </div>
  )
}

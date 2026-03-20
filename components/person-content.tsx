"use client"

import { fetchTrailerKey } from "@/app/actions"
import { MediaCardWithActions } from "@/components/media-card-with-actions"
import { TrailerModal } from "@/components/trailer-modal"
import { FilterTabButton } from "@/components/ui/filter-tab-button"
import { ScrollableRow } from "@/components/ui/scrollable-row"
import { ViewAllLink } from "@/components/ui/view-all-link"
import { usePreferences } from "@/hooks/use-preferences"
import {
  buildPersonCredits,
  getPersonCreditTypeLabel,
  getPersonCreditTypeOrder,
  PERSON_CREDIT_PREVIEW_LIMIT,
  type PersonCreditType,
} from "@/lib/person-credits"
import { getDisplayMediaTitle } from "@/lib/media-title"
import { TMDBActionableMedia, TMDBPersonDetails } from "@/types/tmdb"
import { Film01Icon, Tv01Icon } from "@hugeicons/core-free-icons"
import { useMemo, useState } from "react"
import { toast } from "sonner"

interface PersonContentProps {
  person: TMDBPersonDetails
}

type PersonCreditSection = {
  key: PersonCreditType
  title: string
  href: string
  items: TMDBActionableMedia[]
}

export function PersonContent({ person }: PersonContentProps) {
  const [activeTab, setActiveTab] = useState<"movie" | "tv">("movie")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [trailerKey, setTrailerKey] = useState<string | null>(null)
  const [selectedTrailerMedia, setSelectedTrailerMedia] =
    useState<TMDBActionableMedia | null>(null)
  const [loadingMediaId, setLoadingMediaId] = useState<number | null>(null)
  const { preferences } = usePreferences()

  const creditsByTab = useMemo(() => buildPersonCredits(person), [person])

  const currentTabCredits = creditsByTab[activeTab]
  const allSections: PersonCreditSection[] = getPersonCreditTypeOrder(
    person.known_for_department,
  ).map((creditType) => ({
    key: creditType,
    title: `${getPersonCreditTypeLabel(creditType)} (${currentTabCredits[creditType].length})`,
    href: `/person/${person.id}/credits?mediaType=${activeTab}&creditType=${creditType}`,
    items: currentTabCredits[creditType],
  }))
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
          onClick={() => setActiveTab("movie")}
        />
        <FilterTabButton
          label="TV Shows"
          count={creditsByTab.tv.count}
          isActive={activeTab === "tv"}
          icon={Tv01Icon}
          onClick={() => setActiveTab("tv")}
        />
      </div>

      {sections.length === 0 ? (
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

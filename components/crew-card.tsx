"use client"

import { AuthModal } from "@/components/auth-modal"
import { ImageWithFallback } from "@/components/ui/image-with-fallback"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import {
  useFavoritePersonActions,
  useIsPersonFavorited,
} from "@/hooks/use-favorite-persons"
import { buildImageUrl } from "@/lib/tmdb"
import type { CrewMember } from "@/types/tmdb"
import { FavouriteIcon, Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"
import { toast } from "sonner"

interface CrewCardProps {
  /** Crew member data */
  crew: CrewMember
  /** Priority loading for above-the-fold images */
  priority?: boolean
}

/**
 * CrewCard Component
 * Displays a crew member's photo, name, and job
 * Links to the person detail page
 * Shows a favorite heart icon on hover to add/remove from favorites
 */
export function CrewCard({ crew, priority = false }: CrewCardProps) {
  const profileUrl = buildImageUrl(crew.profile_path, "w500")
  const { requireAuth, modalVisible, closeModal } = useAuthGuard()
  const { isFavorited, loading: favLoading } = useIsPersonFavorited(crew.id)
  const { addPerson, removePerson, isAdding, isRemoving } =
    useFavoritePersonActions()

  const isProcessing = isAdding || isRemoving

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    requireAuth(async () => {
      try {
        if (isFavorited) {
          await removePerson(crew.id)
          toast.success(`Removed ${crew.name} from favorites`)
        } else {
          await addPerson({
            id: crew.id,
            name: crew.name,
            profile_path: crew.profile_path,
            known_for_department: crew.department || "Crew",
          })
          toast.success(`Added ${crew.name} to favorites`)
        }
      } catch (error) {
        console.error("Failed to toggle favorite:", error)
        toast.error(
          isFavorited
            ? "Failed to remove from favorites"
            : "Failed to add to favorites",
        )
      }
    })
  }

  return (
    <>
      <Link href={`/person/${crew.id}`} className="block shrink-0">
        <div className="group relative w-full overflow-hidden rounded-xl bg-card shadow-md transition-all duration-300 cursor-pointer">
          {/* Profile Image */}
          <div className="relative aspect-2/3 w-full overflow-hidden bg-gray-900">
            <ImageWithFallback
              src={profileUrl}
              alt={crew.name}
              fallbackText="No Photo"
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 14vw"
              priority={priority}
            />

            {/* Favorite Heart Icon - appears on hover or when favorited/processing */}
            <button
              onClick={handleFavoriteClick}
              disabled={isProcessing || favLoading}
              className={`absolute top-2 right-2 flex items-center justify-center w-8 h-8 rounded-full bg-black/70 text-white transition-all duration-200 hover:scale-110 disabled:cursor-not-allowed z-10 ${
                isFavorited || isProcessing
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100"
              }`}
              aria-label={
                isFavorited
                  ? `Remove ${crew.name} from favorites`
                  : `Add ${crew.name} to favorites`
              }
            >
              {isProcessing ? (
                <HugeiconsIcon
                  icon={Loading03Icon}
                  className="size-4 animate-spin"
                />
              ) : (
                <HugeiconsIcon
                  icon={FavouriteIcon}
                  className={`size-4 transition-colors ${
                    isFavorited ? "text-red-500 fill-red-500" : "text-white"
                  }`}
                />
              )}
            </button>
          </div>

          {/* Info Content */}
          <div className="flex flex-col gap-1 p-3">
            <h3 className="line-clamp-1 text-sm font-bold text-white">
              {crew.name}
            </h3>
            <p className="line-clamp-1 text-xs text-gray-400 font-medium">
              {crew.job}
            </p>
          </div>
        </div>
      </Link>

      {/* Auth modal for unauthenticated users */}
      <AuthModal isOpen={modalVisible} onClose={closeModal} />
    </>
  )
}

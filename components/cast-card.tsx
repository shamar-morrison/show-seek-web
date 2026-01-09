"use client"

import { AuthModal } from "@/components/auth-modal"
import { useAuth } from "@/context/auth-context"
import {
  useFavoritePersonActions,
  useIsPersonFavorited,
} from "@/hooks/use-favorite-persons"
import { buildImageUrl } from "@/lib/tmdb"
import type { CastMember } from "@/types/tmdb"
import { FavouriteIcon, Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

interface CastCardProps {
  /** Cast member data */
  cast: CastMember
  /** Priority loading for above-the-fold images */
  priority?: boolean
}

/**
 * CastCard Component
 * Displays a cast member's photo, name, and character
 * Links to the person detail page
 * Shows a favorite heart icon on hover to add/remove from favorites
 */
export function CastCard({ cast, priority = false }: CastCardProps) {
  const profileUrl = buildImageUrl(cast.profile_path, "w500")
  const { user } = useAuth()
  const { isFavorited, loading: favLoading } = useIsPersonFavorited(cast.id)
  const { addPerson, removePerson, isAdding, isRemoving } =
    useFavoritePersonActions()
  const [showAuthModal, setShowAuthModal] = useState(false)

  const isAuthenticated = !!user && !user.isAnonymous
  const isProcessing = isAdding || isRemoving

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Show auth modal if not authenticated
    if (!isAuthenticated) {
      setShowAuthModal(true)
      return
    }

    try {
      if (isFavorited) {
        await removePerson(cast.id)
        toast.success(`Removed ${cast.name} from favorites`)
      } else {
        await addPerson({
          id: cast.id,
          name: cast.name,
          profile_path: cast.profile_path,
          known_for_department: "Acting",
        })
        toast.success(`Added ${cast.name} to favorites`)
      }
    } catch (error) {
      console.error("Failed to toggle favorite:", error)
      toast.error(
        isFavorited
          ? "Failed to remove from favorites"
          : "Failed to add to favorites",
      )
    }
  }

  return (
    <>
      <Link href={`/person/${cast.id}`} className="block shrink-0">
        <div className="group relative w-36 overflow-hidden rounded-xl bg-card shadow-md transition-all duration-300 cursor-pointer sm:w-40">
          {/* Profile Image */}
          <div className="relative aspect-2/3 w-full overflow-hidden bg-gray-900">
            {profileUrl ? (
              <Image
                src={profileUrl}
                alt={cast.name}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="160px"
                priority={priority}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gray-800 text-gray-500 text-sm">
                No Photo
              </div>
            )}

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
                  ? `Remove ${cast.name} from favorites`
                  : `Add ${cast.name} to favorites`
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
              {cast.name}
            </h3>
            <p className="line-clamp-1 text-xs text-gray-400 font-medium">
              {cast.character}
            </p>
          </div>
        </div>
      </Link>

      {/* Auth modal for unauthenticated users */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </>
  )
}

"use client"

import { AuthModal } from "@/components/auth-modal"
import { useAuth } from "@/context/auth-context"
import {
  useFavoritePersonActions,
  useIsPersonFavorited,
} from "@/hooks/use-favorite-persons"
import { buildImageUrl } from "@/lib/tmdb"
import { FavouriteIcon, Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

interface PersonSearchCardProps {
  /** Person data from search results */
  person: {
    id: number
    name: string
    profile_path?: string | null
    known_for_department?: string
  }
  /** Priority loading for above-the-fold images */
  priority?: boolean
}

/**
 * PersonSearchCard Component
 * Displays a person from search results with photo, name, and department
 * Links to the person detail page
 * Shows a favorite heart icon on hover to add/remove from favorites
 */
export function PersonSearchCard({
  person,
  priority = false,
}: PersonSearchCardProps) {
  const profileUrl = buildImageUrl(person.profile_path ?? null, "w500")
  const { user } = useAuth()
  const { isFavorited, loading: favLoading } = useIsPersonFavorited(person.id)
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
        await removePerson(person.id)
        toast.success(`Removed ${person.name} from favorites`)
      } else {
        await addPerson({
          id: person.id,
          name: person.name,
          profile_path: person.profile_path ?? null,
          known_for_department: person.known_for_department || "Unknown",
        })
        toast.success(`Added ${person.name} to favorites`)
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
      <Link href={`/person/${person.id}`} className="block shrink-0">
        <div className="group relative w-full overflow-hidden rounded-xl bg-card shadow-md transition-all duration-300 cursor-pointer">
          {/* Profile Image */}
          <div className="relative aspect-2/3 w-full overflow-hidden bg-gray-900">
            {profileUrl ? (
              <Image
                src={profileUrl}
                alt={person.name}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 14vw"
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
                  ? `Remove ${person.name} from favorites`
                  : `Add ${person.name} to favorites`
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
              {person.name}
            </h3>
            <p className="line-clamp-1 text-xs text-gray-400 font-medium">
              {person.known_for_department || "Person"}
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

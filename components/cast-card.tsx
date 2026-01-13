"use client"

import { AuthModal } from "@/components/auth-modal"
import { PersonCard } from "@/components/person-card"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import {
  useFavoritePersonActions,
  useIsPersonFavorited,
} from "@/hooks/use-favorite-persons"
import type { CastMember } from "@/types/tmdb"
import { FavouriteIcon, Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"

interface CastCardProps {
  /** Cast member data */
  cast: CastMember
  /** Priority loading for above-the-fold images */
  priority?: boolean
  /** If true, card fills container width (for grids). If false, uses fixed width (for horizontal scroll) */
  fullWidth?: boolean
}

/**
 * CastCard Component
 * Displays a cast member using PersonCard with favorite action
 */
export function CastCard({
  cast,
  priority = false,
  fullWidth = false,
}: CastCardProps) {
  const { requireAuth, modalVisible, closeModal } = useAuthGuard()
  const { isFavorited, loading: favLoading } = useIsPersonFavorited(cast.id)
  const { addPerson, removePerson, isAdding, isRemoving } =
    useFavoritePersonActions()

  const isProcessing = isAdding || isRemoving

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    requireAuth(async () => {
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
    })
  }

  const renderFavoriteAction = () => (
    <button
      onClick={handleFavoriteClick}
      disabled={isProcessing || favLoading}
      className={`flex items-center justify-center w-8 h-8 rounded-full bg-black/70 text-white transition-all duration-200 hover:scale-110 disabled:cursor-not-allowed ${
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
        <HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin" />
      ) : (
        <HugeiconsIcon
          icon={FavouriteIcon}
          className={`size-4 transition-colors ${
            isFavorited ? "text-red-500 fill-red-500" : "text-white"
          }`}
        />
      )}
    </button>
  )

  return (
    <>
      <PersonCard
        id={cast.id}
        name={cast.name}
        profilePath={cast.profile_path}
        subtext={cast.character}
        priority={priority}
        fullWidth={fullWidth}
        renderAction={renderFavoriteAction}
      />

      {/* Auth modal for unauthenticated users */}
      <AuthModal isOpen={modalVisible} onClose={closeModal} />
    </>
  )
}

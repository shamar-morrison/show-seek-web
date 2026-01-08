"use client"

import { AuthModal } from "@/components/auth-modal"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/auth-context"
import {
  useFavoritePersonActions,
  useIsPersonFavorited,
} from "@/hooks/use-favorite-persons"
import { FavouriteIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"
import { toast } from "sonner"

interface FavoritePersonButtonProps {
  /** Person data to save when adding to favorites */
  person: {
    id: number
    name: string
    profile_path: string | null
    known_for_department: string
  }
}

/**
 * Button component for adding/removing a person from favorites
 * Shows different states based on authentication and favorite status
 */
export function FavoritePersonButton({ person }: FavoritePersonButtonProps) {
  const { user, loading: authLoading } = useAuth()
  const { isFavorited, loading: favLoading } = useIsPersonFavorited(person.id)
  const { addPerson, removePerson, isAdding, isRemoving } =
    useFavoritePersonActions()
  const [showAuthModal, setShowAuthModal] = useState(false)

  const isAuthenticated = !!user && !user.isAnonymous
  const isProcessing = isAdding || isRemoving
  const isLoading = authLoading || favLoading

  const handleClick = async () => {
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
          profile_path: person.profile_path,
          known_for_department: person.known_for_department,
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
      <Button
        size="lg"
        onClick={handleClick}
        disabled={isProcessing || isLoading}
        className={`group w-full justify-center gap-2 px-6 font-semibold transition-all ${
          isFavorited
            ? "bg-red-600 text-white hover:bg-red-700"
            : "bg-primary text-white hover:shadow-primary/50"
        }`}
      >
        <HugeiconsIcon
          icon={FavouriteIcon}
          className={`size-5 transition-transform group-hover:scale-110 ${
            isFavorited ? "fill-current" : ""
          }`}
        />
        {isAdding
          ? "Adding..."
          : isRemoving
            ? "Removing..."
            : isFavorited
              ? "Remove from favorites"
              : "Add to favorite people"}
      </Button>

      {/* Auth modal for unauthenticated users */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </>
  )
}

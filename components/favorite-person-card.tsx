"use client"

import { PersonCard } from "@/components/person-card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import type { FavoritePerson } from "@/lib/firebase/favorite-persons"
import { Delete02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

interface FavoritePersonCardProps {
  /** Favorite person data */
  person: FavoritePerson
  /** Callback to remove person from favorites */
  onRemove: (personId: number) => Promise<void>
  /** Priority loading for above-the-fold images */
  priority?: boolean
}

/**
 * FavoritePersonCard Component
 * Displays a favorite person using PersonCard with delete action
 */
export function FavoritePersonCard({
  person,
  onRemove,
  priority = false,
}: FavoritePersonCardProps) {
  const [isRemoving, setIsRemoving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleConfirmRemove = async () => {
    if (isRemoving) return

    setIsRemoving(true)
    try {
      await onRemove(person.id)
      setDialogOpen(false)
    } catch (error) {
      console.error("Failed to remove favorite person:", error)
      setIsRemoving(false)
    }
  }

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const renderDeleteAction = () => (
    <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <AlertDialogTrigger
        onClick={handleTriggerClick}
        disabled={isRemoving}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-600 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={`Remove ${person.name} from favorites`}
      >
        <HugeiconsIcon
          icon={Delete02Icon}
          className={`size-4 ${isRemoving ? "animate-pulse" : ""}`}
        />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove from favorites?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove {person.name} from your favorites?
            You can always add them back later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmRemove}
            disabled={isRemoving}
            variant="destructive"
          >
            {isRemoving ? "Removing..." : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return (
    <PersonCard
      id={person.id}
      name={person.name}
      profilePath={person.profile_path}
      subtext={person.known_for_department}
      priority={priority}
      fullWidth={true}
      renderAction={renderDeleteAction}
    />
  )
}

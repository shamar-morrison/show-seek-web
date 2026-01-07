"use client"

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
import { buildImageUrl } from "@/lib/tmdb"
import { Delete02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Image from "next/image"
import Link from "next/link"
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
 * Displays a favorite person's photo, name, and department
 * Shows delete button on hover, links to person detail page
 */
export function FavoritePersonCard({
  person,
  onRemove,
  priority = false,
}: FavoritePersonCardProps) {
  const [isRemoving, setIsRemoving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const profileUrl = buildImageUrl(person.profile_path, "w500")

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

  return (
    <div className="block shrink-0">
      <div className="group relative w-full overflow-hidden rounded-xl bg-card shadow-md transition-all duration-300 cursor-pointer">
        {/* Clickable area for navigation */}
        <Link href={`/person/${person.id}`} className="block">
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
          </div>

          {/* Info Content */}
          <div className="flex flex-col gap-1 p-3">
            <h3 className="line-clamp-1 text-sm font-bold text-white">
              {person.name}
            </h3>
            <p className="line-clamp-1 text-xs text-gray-400 font-medium">
              {person.known_for_department}
            </p>
          </div>
        </Link>

        {/* Delete Button with Confirmation - Visible on Hover */}
        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogTrigger
            onClick={handleTriggerClick}
            disabled={isRemoving}
            className="absolute top-2 right-2 flex items-center justify-center w-8 h-8 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-600 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed z-10"
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
                Are you sure you want to remove {person.name} from your
                favorites? You can always add them back later.
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
      </div>
    </div>
  )
}

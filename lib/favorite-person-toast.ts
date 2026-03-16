"use client"

import type { FavoritePerson } from "@/lib/firebase/favorite-persons"
import { showActionableSuccessToast } from "@/lib/actionable-toast"

type FavoritePersonInput = Omit<FavoritePerson, "addedAt">

interface ToggleFavoritePersonWithToastOptions {
  addPerson: (person: FavoritePersonInput) => Promise<void>
  isFavorited: boolean
  person: FavoritePersonInput
  removePerson: (personId: number) => Promise<void>
}

export async function toggleFavoritePersonWithToast({
  addPerson,
  isFavorited,
  person,
  removePerson,
}: ToggleFavoritePersonWithToastOptions): Promise<void> {
  if (isFavorited) {
    await removePerson(person.id)
    showActionableSuccessToast(`Removed ${person.name} from favorites`, {
      action: {
        label: "Undo",
        onClick: () =>
          toggleFavoritePersonWithToast({
            addPerson,
            isFavorited: false,
            person,
            removePerson,
          }),
        errorMessage: `Failed to restore ${person.name} to favorites`,
        logMessage: "Failed to undo favorite person removal:",
      },
    })
    return
  }

  await addPerson(person)
  showActionableSuccessToast(`Added ${person.name} to favorites`, {
    action: {
      label: "Undo",
      onClick: () =>
        toggleFavoritePersonWithToast({
          addPerson,
          isFavorited: true,
          person,
          removePerson,
        }),
      errorMessage: `Failed to remove ${person.name} from favorites`,
      logMessage: "Failed to undo favorite person add:",
    },
  })
}

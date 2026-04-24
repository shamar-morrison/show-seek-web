const warnedManagedEditKinds = new Set<"list" | "rating" | "watched">()

export function isTraktManagedListId(listId?: string | null): boolean {
  return Boolean(
    listId &&
    (listId === "already-watched" ||
      listId === "favorites" ||
      listId === "watchlist" ||
      listId.startsWith("trakt_")),
  )
}

function warnOnce(
  kind: "list" | "rating" | "watched",
  showToast: ((message: string) => void) | undefined,
  message: string,
) {
  if (!showToast || warnedManagedEditKinds.has(kind)) {
    return
  }

  warnedManagedEditKinds.add(kind)
  showToast(message)
}

export function maybeWarnTraktManagedListEdit(
  isTraktConnected: boolean,
  listIds: Array<string | undefined | null>,
  showToast: ((message: string) => void) | undefined,
  message = "Trakt is connected. Changes to Trakt-managed lists can be overwritten by your next sync.",
) {
  if (
    !isTraktConnected ||
    !listIds.some((listId) => isTraktManagedListId(listId))
  ) {
    return
  }

  warnOnce("list", showToast, message)
}

export function maybeWarnTraktManagedRatingEdit(
  isTraktConnected: boolean,
  showToast: ((message: string) => void) | undefined,
  message = "Trakt is connected. Rating changes can be overwritten by your next sync.",
) {
  if (!isTraktConnected) {
    return
  }

  warnOnce("rating", showToast, message)
}

export function maybeWarnTraktManagedWatchedEdit(
  isTraktConnected: boolean,
  showToast: ((message: string) => void) | undefined,
  message = "Trakt is connected. Watched-state changes can be overwritten by your next sync.",
) {
  if (!isTraktConnected) {
    return
  }

  warnOnce("watched", showToast, message)
}

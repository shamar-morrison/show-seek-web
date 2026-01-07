/**
 * Firebase Firestore operations for episode tracking
 * Path: users/{userId}/episode_tracking/{tvShowId}
 */

import type { TVShowEpisodeTracking } from "@/types/episode-tracking"
import { collection, onSnapshot, type Unsubscribe } from "firebase/firestore"
import { db } from "./config"

/**
 * Get the Firestore reference for a user's episode tracking collection
 */
function getEpisodeTrackingCollectionRef(userId: string) {
  return collection(db, "users", userId, "episode_tracking")
}

/**
 * Subscribe to real-time updates for all user's tracked TV shows
 * Returns an unsubscribe function
 */
export function subscribeToAllEpisodeTracking(
  userId: string,
  onTrackingChange: (tracking: Map<string, TVShowEpisodeTracking>) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const trackingRef = getEpisodeTrackingCollectionRef(userId)

  return onSnapshot(
    trackingRef,
    (snapshot) => {
      const trackingMap = new Map<string, TVShowEpisodeTracking>()
      snapshot.docs.forEach((doc) => {
        const data = doc.data() as TVShowEpisodeTracking
        // doc.id is the tvShowId
        trackingMap.set(doc.id, data)
      })
      onTrackingChange(trackingMap)
    },
    (error) => {
      console.error("Error subscribing to episode tracking:", error)
      onError?.(error)
    },
  )
}

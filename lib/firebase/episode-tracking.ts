/**
 * Firebase Firestore operations for episode tracking
 * Path: users/{userId}/episode_tracking/{tvShowId}
 */

import type { TVShowEpisodeTracking } from "@/types/episode-tracking"
import { collection, getDocs } from "firebase/firestore"
import { db } from "./config"

/**
 * Get the Firestore reference for a user's episode tracking collection
 */
function getEpisodeTrackingCollectionRef(userId: string) {
  return collection(db, "users", userId, "episode_tracking")
}

/**
 * Fetch all tracked shows with a one-time read.
 */
export async function fetchAllEpisodeTracking(
  userId: string,
): Promise<Map<string, TVShowEpisodeTracking>> {
  const trackingRef = getEpisodeTrackingCollectionRef(userId)
  const snapshot = await getDocs(trackingRef)
  const trackingMap = new Map<string, TVShowEpisodeTracking>()

  snapshot.docs.forEach((trackingDoc) => {
    const data = trackingDoc.data() as TVShowEpisodeTracking
    trackingMap.set(trackingDoc.id, data)
  })

  return trackingMap
}

/**
 * Firebase Firestore operations for episode tracking
 * Path: users/{userId}/episode_tracking/{tvShowId}
 */

import type { TVShowEpisodeTracking } from "@/types/episode-tracking"
import { collection, doc, getDoc, getDocs } from "firebase/firestore"
import { db } from "./config"

/**
 * Get the Firestore reference for a user's episode tracking collection
 */
function getEpisodeTrackingCollectionRef(userId: string) {
  return collection(db, "users", userId, "episode_tracking")
}

function getEpisodeTrackingRef(userId: string, tvShowId: number) {
  return doc(db, "users", userId, "episode_tracking", tvShowId.toString())
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

/**
 * Fetch tracking data for a single show with a one-time read.
 */
export async function fetchEpisodeTrackingShow(
  userId: string,
  tvShowId: number,
): Promise<TVShowEpisodeTracking | null> {
  const trackingRef = getEpisodeTrackingRef(userId, tvShowId)
  const snapshot = await getDoc(trackingRef)

  if (!snapshot.exists()) {
    return null
  }

  return snapshot.data() as TVShowEpisodeTracking
}

"use client"

/**
 * Firebase Firestore operations for episode tracking
 * Path: users/{userId}/episode_tracking/{tvShowId}
 */

import type { TVShowEpisodeTracking } from "@/types/episode-tracking"
import { normalizeEpisodeTrackingDoc } from "@/lib/episode-tracking-normalization"
import { collection, getDocs } from "firebase/firestore"
import { getFirebaseDb } from "./config"

/**
 * Get the Firestore reference for a user's episode tracking collection
 */
function getEpisodeTrackingCollectionRef(userId: string) {
  return collection(getFirebaseDb(), "users", userId, "episode_tracking")
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
    trackingMap.set(
      trackingDoc.id,
      normalizeEpisodeTrackingDoc(trackingDoc.data()),
    )
  })

  return trackingMap
}

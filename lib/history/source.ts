"use client"

import { collection, getDocs } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/config"
import type { UserList } from "@/types/list"
import type { HistorySource } from "./calculator"
import { normalizeEpisodeTrackingDoc } from "./episode-normalization"
import { normalizeRatingItem } from "./rating-normalization"
import { toMillis } from "./timestamps"

import type { HistoryCollection } from "./keys"

export interface HistoryDocument {
  id: string
  data: Record<string, unknown>
}

/** Preserve Firestore order and mobile's acceptance rules. Never use UI-filtered lists. */
export function normalizeHistoryDocuments<K extends HistoryCollection>(
  kind: K,
  docs: HistoryDocument[],
): HistorySource[K] {
  if (kind === "episodes") {
    return docs.flatMap(({ id, data }) => {
      const tracking = normalizeEpisodeTrackingDoc(data, id)
      return tracking
        ? Object.values(tracking.episodes).map((episode) => ({
            ...episode,
            tvShowName: tracking.metadata.tvShowName,
            posterPath: tracking.metadata.posterPath,
          }))
        : []
    }) as HistorySource[K]
  }
  if (kind === "ratings") {
    return docs.flatMap(({ id, data }) => {
      const rating = normalizeRatingItem(data, id, "History")
      return rating ? [rating] : []
    }) as HistorySource[K]
  }
  return docs.map(({ id, data }) => ({
    id,
    name: data.name,
    createdAt: toMillis(data.createdAt) ?? 0,
    items: Object.fromEntries(
      Object.entries(
        (data.items ?? {}) as Record<string, Record<string, unknown>>,
      )
        .filter(([, item]) => item && typeof item === "object")
        .map(([key, item]) => [
          key,
          { ...item, addedAt: toMillis(item.addedAt) },
        ]),
    ),
  })) as UserList[] as HistorySource[K]
}

export async function fetchHistoryCollection<K extends HistoryCollection>(
  uid: string,
  kind: K,
): Promise<HistorySource[K]> {
  const path = kind === "episodes" ? "episode_tracking" : kind
  const snapshot = await getDocs(
    collection(getFirebaseDb(), "users", uid, path),
  )
  return normalizeHistoryDocuments(
    kind,
    snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() })),
  )
}

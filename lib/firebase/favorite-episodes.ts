"use client"

import type { FavoriteEpisode } from "@/types/favorite-episode"
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore"
import { getFirebaseDb } from "./config"

function getFavoriteEpisodesCollectionRef(userId: string) {
  return collection(getFirebaseDb(), "users", userId, "favorite_episodes")
}

function getFavoriteEpisodeRef(userId: string, episodeId: string) {
  return doc(getFirebaseDb(), "users", userId, "favorite_episodes", episodeId)
}

function toFavoriteEpisode(data: Record<string, unknown>): FavoriteEpisode {
  return {
    id: data.id as string,
    tvShowId: data.tvShowId as number,
    seasonNumber: data.seasonNumber as number,
    episodeNumber: data.episodeNumber as number,
    episodeName: data.episodeName as string,
    showName: data.showName as string,
    posterPath: (data.posterPath as string | null | undefined) ?? null,
    addedAt: data.addedAt as number,
  }
}

export async function fetchFavoriteEpisodes(
  userId: string,
): Promise<FavoriteEpisode[]> {
  const episodesRef = getFavoriteEpisodesCollectionRef(userId)
  const favoriteEpisodesQuery = query(episodesRef, orderBy("addedAt", "desc"))
  const snapshot = await getDocs(favoriteEpisodesQuery)

  return snapshot.docs.map((docSnapshot) =>
    toFavoriteEpisode(docSnapshot.data()),
  )
}

export async function addFavoriteEpisode(
  userId: string,
  episodeData: Omit<FavoriteEpisode, "addedAt">,
): Promise<void> {
  const episodeRef = getFavoriteEpisodeRef(userId, episodeData.id)

  const favoriteEpisode: FavoriteEpisode = {
    ...episodeData,
    addedAt: Date.now(),
  }

  await setDoc(episodeRef, favoriteEpisode)
}

export async function removeFavoriteEpisode(
  userId: string,
  episodeId: string,
): Promise<void> {
  const episodeRef = getFavoriteEpisodeRef(userId, episodeId)
  await deleteDoc(episodeRef)
}

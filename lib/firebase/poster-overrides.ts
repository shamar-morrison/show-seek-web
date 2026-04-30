"use client"

import {
  buildPosterOverrideKey,
  POSTER_OVERRIDE_MAX_ENTRIES,
  sanitizePosterOverrides,
  type PosterOverrideMediaType,
} from "@/lib/poster-overrides"
import {
  deleteField,
  doc,
  runTransaction,
  setDoc,
  updateDoc,
} from "firebase/firestore"
import { getFirebaseDb } from "./config"

function getUserDocRef(userId: string) {
  return doc(getFirebaseDb(), "users", userId)
}

export async function setPosterOverride(
  userId: string,
  mediaType: PosterOverrideMediaType,
  mediaId: number,
  posterPath: string,
): Promise<void> {
  const key = buildPosterOverrideKey(mediaType, mediaId)
  const userDocRef = getUserDocRef(userId)
  await runTransaction(getFirebaseDb(), async (transaction) => {
    const snapshot = await transaction.get(userDocRef)
    const overrides = sanitizePosterOverrides(
      snapshot.data()?.preferences?.posterOverrides,
    )
    const overrideCount = Object.keys(overrides).length
    const isExistingOverride = Object.prototype.hasOwnProperty.call(
      overrides,
      key,
    )

    if (!isExistingOverride && overrideCount >= POSTER_OVERRIDE_MAX_ENTRIES) {
      throw new Error(
        `You can save up to ${POSTER_OVERRIDE_MAX_ENTRIES} poster overrides`,
      )
    }

    const nextOverrides = {
      ...overrides,
      [key]: posterPath,
    }

    if (snapshot.exists()) {
      transaction.update(userDocRef, {
        "preferences.posterOverrides": nextOverrides,
      })
      return
    }

    transaction.set(
      userDocRef,
      {
        preferences: {
          posterOverrides: nextOverrides,
        },
      },
      { merge: true },
    )
  })
}

export async function clearPosterOverride(
  userId: string,
  mediaType: PosterOverrideMediaType,
  mediaId: number,
): Promise<void> {
  const key = buildPosterOverrideKey(mediaType, mediaId)
  const userDocRef = getUserDocRef(userId)

  await setDoc(userDocRef, {}, { merge: true })
  await updateDoc(userDocRef, {
    [`preferences.posterOverrides.${key}`]: deleteField(),
  })
}

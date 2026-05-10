"use client"

/**
 * Firebase Firestore operations for user ratings
 * Path: users/{userId}/ratings/{ratingId}
 */

import type { Rating, RatingInput } from "@/types/rating"
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore"
import { getFirebaseDb } from "./config"

const VALID_MEDIA_TYPES = new Set<Rating["mediaType"]>([
  "movie",
  "tv",
  "episode",
  "season",
])
const EPISODE_RATING_ID_PATTERN = /^episode-(\d+)-(\d+)-(\d+)$/
const SEASON_RATING_ID_PATTERN = /^season-(\d+)-(\d+)$/

type SeasonRatingInput = RatingInput & {
  mediaType: "season"
  tvShowId: number
  seasonNumber: number
  tvShowName?: string
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  if (value instanceof Timestamp) {
    return value.toMillis()
  }

  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.getTime() : null
  }

  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    const parsed = value.toMillis()
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function toMediaType(value: unknown): Rating["mediaType"] | null {
  return VALID_MEDIA_TYPES.has(value as Rating["mediaType"])
    ? (value as Rating["mediaType"])
    : null
}

function parseEpisodeRatingDocId(docId: string) {
  const match = docId.match(EPISODE_RATING_ID_PATTERN)
  if (!match) return null

  return {
    tvShowId: Number(match[1]),
    seasonNumber: Number(match[2]),
    episodeNumber: Number(match[3]),
  }
}

function parseSeasonRatingDocId(docId: string) {
  const match = docId.match(SEASON_RATING_ID_PATTERN)
  if (!match) return null

  return {
    tvShowId: Number(match[1]),
    seasonNumber: Number(match[2]),
  }
}

function toNormalizedMediaId(
  docId: string,
  data: Record<string, unknown>,
  mediaType: Rating["mediaType"],
): string | null {
  if (mediaType === "movie" || mediaType === "tv") {
    const storedId = toFiniteNumber(data.mediaId) ?? toFiniteNumber(data.id)
    if (storedId !== null) {
      return storedId.toString()
    }

    const prefix = `${mediaType}-`
    if (!docId.startsWith(prefix)) {
      return null
    }

    const parsed = toFiniteNumber(docId.slice(prefix.length))
    return parsed !== null ? parsed.toString() : null
  }

  if (mediaType === "episode") {
    const storedId = toFiniteNumber(data.tvShowId)
    if (storedId !== null) {
      return storedId.toString()
    }

    const parsedDocId = parseEpisodeRatingDocId(docId)
    return parsedDocId ? parsedDocId.tvShowId.toString() : null
  }

  const storedId = toFiniteNumber(data.tvShowId)
  if (storedId !== null) {
    return storedId.toString()
  }

  const parsedDocId = parseSeasonRatingDocId(docId)
  return parsedDocId ? parsedDocId.tvShowId.toString() : null
}

/**
 * Convert Firestore document data to Rating interface
 * Handles Timestamp -> number conversion for ratedAt
 * Compatible with mobile app's data structure
 */
function toRating(docId: string, data: Record<string, unknown>): Rating | null {
  const mediaType = toMediaType(data.mediaType)
  const rating = toFiniteNumber(data.rating)
  const ratedAt = toFiniteNumber(data.ratedAt)
  const parsedEpisodeDocId = parseEpisodeRatingDocId(docId)
  const parsedSeasonDocId = parseSeasonRatingDocId(docId)
  const mediaId =
    mediaType !== null ? toNormalizedMediaId(docId, data, mediaType) : null

  if (!mediaType || rating === null || ratedAt === null || mediaId === null) {
    console.warn(
      `[ratings] Skipping invalid rating doc ${docId}: missing valid mediaType, rating, ratedAt, or mediaId.`,
    )
    return null
  }

  const tvShowId =
    toFiniteNumber(data.tvShowId) ?? parsedEpisodeDocId?.tvShowId ?? parsedSeasonDocId?.tvShowId
  const seasonNumber =
    toFiniteNumber(data.seasonNumber) ??
    parsedEpisodeDocId?.seasonNumber ??
    parsedSeasonDocId?.seasonNumber
  const episodeNumber =
    toFiniteNumber(data.episodeNumber) ?? parsedEpisodeDocId?.episodeNumber

  if (mediaType === "season" && (tvShowId == null || seasonNumber == null)) {
    console.warn(
      `[ratings] Skipping invalid season rating doc ${docId}: missing tvShowId or seasonNumber.`,
    )
    return null
  }

  if (
    mediaType === "episode" &&
    (tvShowId == null || seasonNumber == null || episodeNumber == null)
  ) {
    console.warn(
      `[ratings] Skipping invalid episode rating doc ${docId}: missing tvShowId, seasonNumber, or episodeNumber.`,
    )
    return null
  }

  return {
    id: docId,
    mediaId,
    mediaType,
    rating,
    // For episodes, use episodeName as title when title is not stored.
    title: (data.title as string) || (data.episodeName as string) || "",
    originalTitle: data.originalTitle as string | undefined,
    posterPath: (data.posterPath as string) || null,
    releaseDate: (data.releaseDate as string) || null,
    ratedAt,
    tvShowId: tvShowId ?? undefined,
    seasonNumber: seasonNumber ?? undefined,
    episodeNumber: episodeNumber ?? undefined,
    episodeName: data.episodeName as string | undefined,
    tvShowName: data.tvShowName as string | undefined,
  }
}

/**
 * Generate document ID for a rating
 * Format: {mediaType}-{mediaId}
 */
function getRatingDocId(mediaType: "movie" | "tv", mediaId: number): string {
  return `${mediaType}-${mediaId}`
}

function getEpisodeRatingDocId(
  tvShowId: number,
  seasonNumber: number,
  episodeNumber: number,
): string {
  return `episode-${tvShowId}-${seasonNumber}-${episodeNumber}`
}

function getSeasonRatingDocId(tvShowId: number, seasonNumber: number): string {
  return `season-${tvShowId}-${seasonNumber}`
}

/**
 * Get the Firestore reference for a user's ratings collection
 */
function getRatingsCollectionRef(userId: string) {
  return collection(getFirebaseDb(), "users", userId, "ratings")
}

/**
 * Fetch all ratings for a user with a one-time read.
 */
export async function fetchRatings(userId: string): Promise<Map<string, Rating>> {
  const ratingsRef = getRatingsCollectionRef(userId)
  const snapshot = await getDocs(ratingsRef)
  const ratingsMap = new Map<string, Rating>()

  snapshot.docs.forEach((docSnapshot) => {
    const rating = toRating(docSnapshot.id, docSnapshot.data())
    if (rating) {
      ratingsMap.set(docSnapshot.id, rating)
    }
  })

  return ratingsMap
}

/**
 * Get the Firestore reference for a specific rating
 */
function getRatingRef(
  userId: string,
  mediaType: "movie" | "tv",
  mediaId: number | string,
) {
  const docId = getRatingDocId(
    mediaType,
    typeof mediaId === "number" ? mediaId : parseInt(mediaId),
  )
  return doc(getFirebaseDb(), "users", userId, "ratings", docId)
}

function getSeasonRatingRef(
  userId: string,
  tvShowId: number,
  seasonNumber: number,
) {
  const docId = getSeasonRatingDocId(tvShowId, seasonNumber)
  return doc(getFirebaseDb(), "users", userId, "ratings", docId)
}

/**
 * Set or update a rating for a media item
 * Uses a transaction to preserve createdAt on updates
 * Only sets createdAt for new documents, always updates updatedAt
 */
export async function setRating(
  userId: string,
  input: RatingInput,
): Promise<void> {
  if (userId !== input.userId) {
    throw new Error(
      `UserId mismatch: path userId ${userId} does not match input userId ${input.userId}`,
    )
  }

  // Handle episode ratings with their own document ID format
  if (input.mediaType === "episode") {
    if (!input.tvShowId || !input.seasonNumber || !input.episodeNumber) {
      throw new Error(
        "Episode ratings require tvShowId, seasonNumber, and episodeNumber",
      )
    }

    const docId = getEpisodeRatingDocId(
      input.tvShowId,
      input.seasonNumber,
      input.episodeNumber,
    )
    const ratingRef = doc(getFirebaseDb(), "users", userId, "ratings", docId)

    await runTransaction(getFirebaseDb(), async (transaction) => {
      transaction.set(
        ratingRef,
        {
          id: docId, // Use the document ID format
          mediaType: "episode",
          rating: input.rating,
          episodeName: input.title, // Episode name
          posterPath: input.posterPath,
          ratedAt: serverTimestamp(),
          // Episode-specific fields
          tvShowId: input.tvShowId,
          tvShowName: input.tvShowName,
          seasonNumber: input.seasonNumber,
          episodeNumber: input.episodeNumber,
        },
        { merge: true },
      )
    })
    return
  }

  if (input.mediaType === "season") {
    throw new Error("Use setSeasonRating for season ratings")
  }

  const ratingRef = getRatingRef(userId, input.mediaType, input.mediaId)

  await runTransaction(getFirebaseDb(), async (transaction) => {
    const data: Record<string, unknown> = {
      id: input.mediaId,
      mediaType: input.mediaType,
      rating: input.rating,
      title: input.title,
      posterPath: input.posterPath,
      releaseDate: input.releaseDate,
      // Always set ratedAt to current timestamp (matches mobile behavior)
      ratedAt: serverTimestamp(),
    }

    if (input.originalTitle !== undefined) {
      data.originalTitle = input.originalTitle
    }

    // Use mobile app's field structure
    transaction.set(
      ratingRef,
      data,
      { merge: true },
    )
  })
}

export async function setSeasonRating(
  userId: string,
  input: SeasonRatingInput,
): Promise<void> {
  if (userId !== input.userId) {
    throw new Error(
      `UserId mismatch: path userId ${userId} does not match input userId ${input.userId}`,
    )
  }

  const ratingRef = getSeasonRatingRef(
    userId,
    input.tvShowId,
    input.seasonNumber,
  )
  const docId = getSeasonRatingDocId(input.tvShowId, input.seasonNumber)

  await runTransaction(getFirebaseDb(), async (transaction) => {
    transaction.set(
      ratingRef,
      {
        id: docId,
        mediaType: "season",
        rating: input.rating,
        title: input.title,
        posterPath: input.posterPath,
        releaseDate: input.releaseDate,
        ratedAt: serverTimestamp(),
        tvShowId: input.tvShowId,
        seasonNumber: input.seasonNumber,
        tvShowName: input.tvShowName,
      },
      { merge: true },
    )
  })
}

/**
 * Get a user's rating for a specific media item
 * Returns null if no rating exists
 */
export async function getRating(
  userId: string,
  mediaType: "movie" | "tv",
  mediaId: number,
): Promise<Rating | null> {
  const ratingRef = getRatingRef(userId, mediaType, mediaId)
  const snapshot = await getDoc(ratingRef)

  if (!snapshot.exists()) {
    return null
  }

  return toRating(snapshot.id, snapshot.data())
}

/**
 * Delete a rating for a media item
 */
export async function deleteRating(
  userId: string,
  mediaType: "movie" | "tv",
  mediaId: number,
): Promise<void> {
  const ratingRef = getRatingRef(userId, mediaType, mediaId)
  await deleteDoc(ratingRef)
}

/**
 * Delete an episode rating
 */
export async function deleteEpisodeRating(
  userId: string,
  tvShowId: number,
  seasonNumber: number,
  episodeNumber: number,
): Promise<void> {
  const docId = getEpisodeRatingDocId(tvShowId, seasonNumber, episodeNumber)
  const ratingRef = doc(getFirebaseDb(), "users", userId, "ratings", docId)
  await deleteDoc(ratingRef)
}

export async function deleteSeasonRating(
  userId: string,
  tvShowId: number,
  seasonNumber: number,
): Promise<void> {
  const ratingRef = getSeasonRatingRef(userId, tvShowId, seasonNumber)
  await deleteDoc(ratingRef)
}

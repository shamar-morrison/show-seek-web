"use client"

import {
  getFirebaseDb,
  getFirebaseFunctions,
  getFirebaseStorage,
  isFirebaseClientConfigured,
} from "@/lib/firebase/config"
import type {
  TraktZipImportProgressDoc,
  TraktZipImportStats,
} from "@/types/trakt"
import { doc, onSnapshot } from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { ref, uploadBytesResumable } from "firebase/storage"

export class TraktZipUploadError extends Error {
  constructor(
    message: string,
    readonly originalError?: unknown,
  ) {
    super(message)
    this.name = "TraktZipUploadError"
  }
}

export class TraktZipImportError extends Error {
  constructor(
    message: string,
    readonly originalError?: unknown,
  ) {
    super(message)
    this.name = "TraktZipImportError"
  }
}

export class TraktZipRateLimitedError extends Error {
  constructor(
    message: string,
    readonly nextAllowedImportAt?: string,
  ) {
    super(message)
    this.name = "TraktZipRateLimitedError"
  }
}

export const generateImportId = (): string => {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 10)
  return `zip_${timestamp}_${randomPart}`
}

export const createEmptyTraktZipStats = (): TraktZipImportStats => ({
  customLists: 0,
  episodes: 0,
  favorites: 0,
  movies: 0,
  movieWatches: 0,
  ratings: 0,
  shows: 0,
  watchlist: 0,
})

const DEV_SYNC_BYPASS_HEADER = "X-ShowSeek-Dev-Sync"

export async function uploadZipFile(
  userId: string,
  importId: string,
  file: File,
  onProgress?: (progress: number) => void,
): Promise<string> {
  if (!isFirebaseClientConfigured) {
    throw new TraktZipUploadError("Firebase client configuration is missing.")
  }

  try {
    const storagePath = `users/${userId}/imports/${importId}.zip`
    const storageRef = ref(getFirebaseStorage(), storagePath)

    await new Promise<void>((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: "application/zip",
      })

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            snapshot.totalBytes > 0
              ? snapshot.bytesTransferred / snapshot.totalBytes
              : 0
          onProgress?.(progress)
        },
        (error) => {
          reject(
            new TraktZipUploadError(
              `Upload failed: ${error.message || "Network error while uploading archive."}`,
              error,
            ),
          )
        },
        () => {
          onProgress?.(1)
          resolve()
        },
      )
    })

    return storagePath
  } catch (error) {
    if (error instanceof TraktZipUploadError) {
      throw error
    }
    const message =
      error instanceof Error
        ? error.message
        : "Could not read or upload the selected file."
    throw new TraktZipUploadError(message, error)
  }
}

export async function startImport(
  importId: string,
): Promise<{ importId: string }> {
  if (!isFirebaseClientConfigured) {
    throw new TraktZipImportError("Firebase client configuration is missing.")
  }

  try {
    const startImportCallable = httpsCallable<
      { importId: string; [key: string]: unknown },
      { importId: string }
    >(getFirebaseFunctions(), "startTraktZipImport")

    const payload: { importId: string; [key: string]: unknown } = { importId }
    if (process.env.NODE_ENV === "development") {
      payload[DEV_SYNC_BYPASS_HEADER] = "true"
    }
    const result = await startImportCallable(payload)
    return result.data
  } catch (error) {
    const code = (error as { code?: string } | null)?.code
    if (
      code === "functions/resource-exhausted" ||
      code === "resource-exhausted"
    ) {
      const details = (
        error as { details?: { nextAllowedImportAt?: unknown } } | null
      )?.details
      throw new TraktZipRateLimitedError(
        "Please wait before starting another Trakt zip import.",
        typeof details?.nextAllowedImportAt === "string"
          ? details.nextAllowedImportAt
          : undefined,
      )
    }
    const message =
      error instanceof Error
        ? error.message
        : "Failed to initiate background import processing."
    throw new TraktZipImportError(message, error)
  }
}

export function subscribeToProgress(
  userId: string,
  importId: string,
  onUpdate: (data: TraktZipImportProgressDoc) => void,
  onError?: (error: Error) => void,
): () => void {
  if (!isFirebaseClientConfigured) {
    return () => {}
  }

  const docRef = doc(
    getFirebaseDb(),
    "users",
    userId,
    "trakt_imports",
    importId,
  )

  const unsubscribe = onSnapshot(
    docRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        return
      }

      const rawData = snapshot.data() as Partial<TraktZipImportProgressDoc>
      const progressDoc: TraktZipImportProgressDoc = {
        completedAt: rawData.completedAt,
        createdAt: rawData.createdAt,
        error: rawData.error,
        failedAt: rawData.failedAt,
        id: rawData.id || importId,
        nextAllowedImportAt: rawData.nextAllowedImportAt,
        progress: rawData.progress || {
          current: 0,
          phase: "pending",
          total: 100,
        },
        stats: rawData.stats || createEmptyTraktZipStats(),
        status: rawData.status || "pending",
        updatedAt: rawData.updatedAt,
        userId: rawData.userId || userId,
      }

      onUpdate(progressDoc)
    },
    (error) => {
      console.error("[TraktZipImportService] Subscription error:", error)
      onError?.(error)
    },
  )

  return unsubscribe
}

"use client"

/**
 * Firebase Firestore operations for user lists
 * Path: users/{userId}/lists/{listId}
 */

import { getFirebaseDb } from "@/lib/firebase/config"
import {
  buildListItemKey,
  getLegacyListItemKey,
  type ListItemMediaType,
} from "@/lib/list-item-keys"
import {
  DEFAULT_LIST_IDS,
  DEFAULT_LISTS,
  ListWriteMediaItem,
  UserList,
} from "@/types/list"
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore"

/**
 * Remove undefined values from an object to prevent Firestore errors
 */
function sanitizeForFirestore<T extends Record<string, unknown>>(
  obj: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as Partial<T>
}

/**
 * Generate a URL-friendly slug from a string
 */
function generateSlug(name: string): string {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

  if (normalized) {
    return normalized
  }

  // Fallback for non-ASCII names (e.g. "日本語")
  // Use a simple DJB2 hash for a deterministic, Firestore-safe ID
  let hash = 5381
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 33) ^ name.charCodeAt(i)
  }
  return `list-${(hash >>> 0).toString(16)}`
}

/**
 * Get the Firestore reference for a user's list
 */
function getListRef(userId: string, listId: string) {
  return doc(getFirebaseDb(), "users", userId, "lists", listId)
}

function getListsCollectionRef(userId: string) {
  return collection(getFirebaseDb(), "users", userId, "lists")
}

function isTimestampLike(value: unknown): value is { toMillis: () => number } {
  return (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  )
}

function getComparableUpdatedAt(value: unknown): number | null {
  if (isTimestampLike(value)) {
    const millis = value.toMillis()
    return Number.isFinite(millis) ? millis : null
  }

  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function normalizeTimestampLike(value: unknown): unknown {
  if (isTimestampLike(value)) {
    const millis = value.toMillis()
    return Number.isFinite(millis) ? millis : value
  }

  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeListItems(
  items: unknown,
): Record<string, ListWriteMediaItem & { addedAt: number }> {
  if (!isRecord(items)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(items).flatMap(([itemKey, item]) => {
      if (!isRecord(item)) {
        return []
      }

      const normalizedAddedAt = normalizeTimestampLike(item.addedAt)

      return [
        [
          itemKey,
          {
            ...item,
            addedAt:
              typeof normalizedAddedAt === "number" ? normalizedAddedAt : 0,
          } as ListWriteMediaItem & { addedAt: number },
        ],
      ]
    }),
  )
}

function normalizeUserList(
  listId: string,
  data: Record<string, unknown>,
): UserList {
  return {
    id: listId,
    ...data,
    items: normalizeListItems(data.items),
  } as UserList
}

/**
 * Fetch all user lists with a one-time read.
 */
export async function fetchUserLists(userId: string): Promise<UserList[]> {
  const listsRef = getListsCollectionRef(userId)
  const snapshot = await getDocs(listsRef)

  return snapshot.docs.map((listSnapshot) =>
    normalizeUserList(listSnapshot.id, listSnapshot.data()),
  )
}

/**
 * Fetch a single user list with a one-time read.
 */
export async function fetchUserList(
  userId: string,
  listId: string,
): Promise<UserList | null> {
  const listRef = getListRef(userId, listId)
  const snapshot = await getDoc(listRef)

  if (!snapshot.exists()) {
    return null
  }

  return {
    ...normalizeUserList(snapshot.id, snapshot.data()),
  }
}

/**
 * Add a media item to a list
 * Idempotent - safe to call multiple times for the same item
 * Uses a transaction to atomically check document existence and set createdAt
 * Returns true if the item was newly added, false if it was updated
 */
export async function addToList(
  userId: string,
  listId: string,
  mediaItem: ListWriteMediaItem,
): Promise<boolean> {
  const listRef = getListRef(userId, listId)
  // Use numeric ID as key to match mobile app format
  const itemKey = String(mediaItem.id)

  const addedAt = mediaItem.addedAt ?? Date.now()
  const sanitizedItem = sanitizeForFirestore({
    ...mediaItem,
    addedAt,
  })

  // Get the list name - for default lists, use the name from DEFAULT_LISTS
  const defaultList = DEFAULT_LISTS.find((l) => l.id === listId)
  const listName = defaultList?.name || listId

  return await runTransaction(getFirebaseDb(), async (transaction) => {
    const docSnap = await transaction.get(listRef)
    const isNewDocument = !docSnap.exists()

    // Check if item already exists
    let isNewItem = true
    if (!isNewDocument) {
      const data = docSnap.data()
      if (data?.items?.[itemKey]) {
        isNewItem = false
      }
    }

    // Build the payload - only include createdAt for new documents
    const payload: Record<string, unknown> = {
      name: listName,
      items: {
        [itemKey]: sanitizedItem,
      },
      updatedAt: serverTimestamp(),
    }

    // Only set createdAt on new documents to preserve original timestamp
    if (isNewDocument) {
      payload.createdAt = serverTimestamp()
      transaction.set(listRef, payload)
    } else {
      transaction.set(listRef, payload, { merge: true })
    }

    return isNewItem
  })
}

/**
 * Remove a media item from a list
 */
export async function removeFromList(
  userId: string,
  listId: string,
  mediaId: string,
): Promise<void> {
  const listRef = getListRef(userId, listId)
  // Use numeric ID as key to match mobile app format
  const itemKey = mediaId

  await setDoc(
    listRef,
    {
      items: {
        [itemKey]: deleteField(),
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

/**
 * Remove a media item from a list while tolerating both legacy and prefixed
 * stored key formats in a single write.
 */
export async function removeMediaFromList(
  userId: string,
  listId: string,
  mediaId: number,
  mediaType: ListItemMediaType,
): Promise<void> {
  const listRef = getListRef(userId, listId)
  const legacyKey = getLegacyListItemKey(mediaId)
  const prefixedKey = buildListItemKey(mediaType, mediaId)

  await setDoc(
    listRef,
    {
      items: {
        [legacyKey]: deleteField(),
        [prefixedKey]: deleteField(),
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

/**
 * Create a new custom list
 * Returns the generated list ID
 */
export async function createList(
  userId: string,
  listName: string,
  description?: string,
): Promise<string> {
  const baseSlug = generateSlug(listName)
  const MAX_ATTEMPTS = 100
  const trimmedDescription = description?.trim()

  return await runTransaction(getFirebaseDb(), async (transaction) => {
    let listId = baseSlug
    let suffix = 1
    let attempt = 0

    while (attempt < MAX_ATTEMPTS) {
      const listRef = doc(getFirebaseDb(), "users", userId, "lists", listId)
      const existing = await transaction.get(listRef)

      if (!existing.exists()) {
        const newList = sanitizeForFirestore({
          id: listId,
          name: listName,
          description: trimmedDescription ? trimmedDescription : undefined,
          items: {},
          createdAt: serverTimestamp(),
          isCustom: true,
        })
        transaction.set(listRef, newList)
        return listId
      }

      listId = `${baseSlug}-${suffix}`
      suffix++
      attempt++
    }

    throw new Error(
      `Failed to create list: too many collisions for name "${listName}"`,
    )
  })
}

/**
 * Restore a previously deleted custom list using its original document ID.
 */
export async function restoreList(
  userId: string,
  list: Pick<
    UserList,
    "id" | "name" | "description" | "items" | "createdAt" | "updatedAt"
  >,
): Promise<boolean> {
  if (DEFAULT_LIST_IDS.has(list.id)) {
    throw new Error("Cannot restore default lists")
  }

  const listRef = getListRef(userId, list.id)
  const restoredList = sanitizeForFirestore({
    id: list.id,
    name: list.name,
    description: list.description?.trim() || undefined,
    items: list.items,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
    isCustom: true,
  })

  return await runTransaction(getFirebaseDb(), async (transaction) => {
    const existingDoc = await transaction.get(listRef)
    let restored = false

    if (!existingDoc.exists()) {
      transaction.set(listRef, restoredList)
      restored = true
      return restored
    }

    const snapshotUpdatedAt = getComparableUpdatedAt(list.updatedAt)
    const currentUpdatedAt = getComparableUpdatedAt(
      existingDoc.data()?.updatedAt,
    )

    if (
      snapshotUpdatedAt !== null &&
      currentUpdatedAt !== null &&
      currentUpdatedAt <= snapshotUpdatedAt
    ) {
      transaction.set(listRef, restoredList)
      restored = true
    }

    return restored
  })
}

/**
 * Delete a custom list
 * Throws an error if attempting to delete a default list
 */
export async function deleteList(
  userId: string,
  listId: string,
): Promise<void> {
  if (DEFAULT_LIST_IDS.has(listId)) {
    throw new Error("Cannot delete default lists")
  }

  const listRef = getListRef(userId, listId)
  await deleteDoc(listRef)
}

/**
 * Update a custom list's name and optional description.
 * Throws an error if attempting to update a default list.
 */
export async function updateList(
  userId: string,
  listId: string,
  newName: string,
  description?: string,
): Promise<void> {
  if (DEFAULT_LIST_IDS.has(listId)) {
    throw new Error("Cannot update default lists")
  }

  const listRef = getListRef(userId, listId)
  const trimmedName = newName.trim()
  const trimmedDescription = description?.trim()

  const payload: Record<string, unknown> = {
    name: trimmedName,
    updatedAt: serverTimestamp(),
  }

  if (description !== undefined) {
    payload.description = trimmedDescription
      ? trimmedDescription
      : deleteField()
  }

  await updateDoc(listRef, payload)
}

export const renameList = updateList

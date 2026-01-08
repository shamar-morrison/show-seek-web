/**
 * Firebase Firestore operations for user lists
 * Path: users/{userId}/lists/{listId}
 */

import { db } from "@/lib/firebase/config"
import { DEFAULT_LIST_IDS, DEFAULT_LISTS, ListMediaItem } from "@/types/list"
import {
  deleteDoc,
  deleteField,
  doc,
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
  return doc(db, "users", userId, "lists", listId)
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
  mediaItem: Omit<ListMediaItem, "addedAt">,
): Promise<boolean> {
  const listRef = getListRef(userId, listId)
  // Use numeric ID as key to match mobile app format
  const itemKey = String(mediaItem.id)

  const sanitizedItem = sanitizeForFirestore({
    ...mediaItem,
    addedAt: Date.now(),
  })

  // Get the list name - for default lists, use the name from DEFAULT_LISTS
  const defaultList = DEFAULT_LISTS.find((l) => l.id === listId)
  const listName = defaultList?.name || listId

  return await runTransaction(db, async (transaction) => {
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
 * Create a new custom list
 * Returns the generated list ID
 */
export async function createList(
  userId: string,
  listName: string,
): Promise<string> {
  const baseSlug = generateSlug(listName)
  const MAX_ATTEMPTS = 100

  return await runTransaction(db, async (transaction) => {
    let listId = baseSlug
    let suffix = 1
    let attempt = 0

    while (attempt < MAX_ATTEMPTS) {
      const listRef = doc(db, "users", userId, "lists", listId)
      const existing = await transaction.get(listRef)

      if (!existing.exists()) {
        const newList = {
          id: listId,
          name: listName,
          items: {},
          createdAt: serverTimestamp(),
          isCustom: true,
        }
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
 * Rename a custom list
 * Throws an error if attempting to rename a default list
 */
export async function renameList(
  userId: string,
  listId: string,
  newName: string,
): Promise<void> {
  if (DEFAULT_LIST_IDS.has(listId)) {
    throw new Error("Cannot rename default lists")
  }

  const listRef = getListRef(userId, listId)
  await updateDoc(listRef, {
    name: newName,
    updatedAt: serverTimestamp(),
  })
}

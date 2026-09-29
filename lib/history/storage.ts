import type { HistorySource } from "./calculator"

export const HISTORY_SCHEMA_VERSION = 1
export interface HistoryRecord {
  version: number
  data?: HistorySource[keyof HistorySource]
  updatedAt: number
  attemptAt?: number
  failedAt?: number
  invalidated?: boolean
}
export interface HistoryStorage {
  get(key: string): Promise<HistoryRecord | undefined>
  put(key: string, record: HistoryRecord): Promise<void>
  remove(key: string): Promise<void>
}

/** Only normalized history arrays live here; no auth tokens or general query persistence. */
export function createHistoryStorage(): HistoryStorage {
  const memory = new Map<string, HistoryRecord>()
  let unavailable = false
  let opening: Promise<IDBDatabase> | undefined
  const open = () =>
    (opening ??= new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === "undefined")
        return reject(new Error("IndexedDB unavailable"))
      const request = indexedDB.open("showseek-history", 1)
      let abandoned = false
      const timeout = setTimeout(() => {
        abandoned = true
        reject(new Error("History storage timed out"))
      }, 2000)
      request.onupgradeneeded = () =>
        request.result.createObjectStore("history")
      request.onsuccess = () => {
        clearTimeout(timeout)
        if (abandoned) {
          request.result.close()
          return
        }
        resolve(request.result)
      }
      request.onerror = () => {
        clearTimeout(timeout)
        reject(request.error)
      }
      request.onblocked = () => {
        clearTimeout(timeout)
        abandoned = true
        reject(new Error("History storage blocked"))
      }
    }))
  async function run<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await open()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("history", mode)
      const request = action(transaction.objectStore("history"))
      transaction.oncomplete = () => resolve(request.result)
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  }
  return {
    async get(key) {
      if (!unavailable) {
        try {
          return await run<HistoryRecord | undefined>("readonly", (store) =>
            store.get(key),
          )
        } catch {
          unavailable = true
        }
      }
      return memory.get(key)
    },
    async put(key, record) {
      memory.set(key, record)
      if (!unavailable) {
        try {
          await run("readwrite", (store) => store.put(record, key))
        } catch {
          unavailable = true
        }
      }
    },
    async remove(key) {
      memory.delete(key)
      if (!unavailable) {
        try {
          await run("readwrite", (store) => store.delete(key))
        } catch {
          unavailable = true
        }
      }
    },
  }
}

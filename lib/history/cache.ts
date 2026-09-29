import {
  CancelledError,
  type QueryClient,
  type InvalidateQueryFilters,
} from "@tanstack/react-query"
import type { HistorySource } from "./calculator"
import {
  createHistoryStorage,
  HISTORY_SCHEMA_VERSION,
  type HistoryRecord,
  type HistoryStorage,
} from "./storage"
import {
  HISTORY_COLLECTIONS,
  HISTORY_ATTEMPT_MS,
  HISTORY_FRESH_MS,
  HISTORY_RETAIN_MS,
  HISTORY_RETRY_MS,
  historyKey,
  isHistoryKey,
  type HistoryCollection,
} from "./keys"

export class HistoryDeferredError extends Error {
  constructor(public retryAt: number) {
    super("History refresh is temporarily cooling down")
  }
}

/** Small synchronous journal closes the reload gap before asynchronous IDB writes commit. */
export interface HistoryJournal {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}
function browserJournal(): HistoryJournal {
  const fallback = new Map<string, string>()
  return {
    get(key) {
      try {
        return sessionStorage.getItem(key)
      } catch {
        return fallback.get(key) ?? null
      }
    },
    set(key, value) {
      fallback.set(key, value)
      try {
        sessionStorage.setItem(key, value)
      } catch {}
    },
    remove(key) {
      fallback.delete(key)
      try {
        sessionStorage.removeItem(key)
      } catch {}
    },
  }
}

export class HistoryCache {
  private uid: string | null = null
  private generation = 0
  private records = new Map<HistoryCollection, HistoryRecord>()
  private revisions = new Map<HistoryCollection, number>()
  private initialization: Promise<void> = Promise.resolve()
  private initialized = false
  private queue: Promise<unknown> = Promise.resolve()
  private listeners = new Set<() => void>()
  private revision = 0
  private manualAt = 0
  constructor(
    private client: QueryClient,
    private storage: HistoryStorage = createHistoryStorage(),
    private now: () => number = Date.now,
    private journal: HistoryJournal = browserJournal(),
  ) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  snapshot = () => this.revision
  private emit() {
    this.revision++
    this.listeners.forEach((fn) => fn())
  }
  private key(uid: string, kind: HistoryCollection) {
    return `showseek:history:v${HISTORY_SCHEMA_VERSION}:${uid}:${kind}`
  }
  private mark(uid: string, kind: HistoryCollection) {
    return `${this.key(uid, kind)}:invalidated`
  }
  private write(task: () => Promise<unknown>) {
    const result = this.queue.then(task)
    this.queue = result.catch(() => {})
    return result
  }
  isReady(uid: string) {
    return this.uid === uid && this.initialized
  }

  /** Called from the auth listener as well as hooks; authentication must finish first. */
  selectUser(uid: string | null): Promise<void> {
    if (uid === this.uid && (this.initialized || uid !== null))
      return this.initialization
    const previous = this.uid ?? this.journal.get("showseek:history:owner")
    const generation = ++this.generation
    this.uid = uid
    this.initialized = false
    this.records.clear()
    this.revisions.clear()
    this.manualAt = 0
    if (previous && previous !== uid) {
      for (const kind of HISTORY_COLLECTIONS) {
        this.journal.set(this.mark(previous, kind), "1")
        void this.write(() => this.storage.remove(this.key(previous, kind)))
      }
      this.journal.remove(`showseek:history:${previous}:manual`)
      void this.client.cancelQueries({
        predicate: (q) => isHistoryKey(q.queryKey),
      })
      this.client.removeQueries({ predicate: (q) => isHistoryKey(q.queryKey) })
    }
    if (uid) this.journal.set("showseek:history:owner", uid)
    else this.journal.remove("showseek:history:owner")
    this.emit()
    this.initialization = (async () => {
      if (!uid) return
      await this.queue
      const records = await Promise.all(
        HISTORY_COLLECTIONS.map((kind) =>
          this.storage.get(this.key(uid, kind)),
        ),
      )
      if (generation !== this.generation) return
      this.manualAt =
        Number(this.journal.get(`showseek:history:${uid}:manual`)) || 0
      HISTORY_COLLECTIONS.forEach((kind, index) => {
        let record = records[index]
        if (
          record?.version !== HISTORY_SCHEMA_VERSION ||
          !Number.isFinite(record?.updatedAt) ||
          (record?.data !== undefined && !Array.isArray(record.data))
        )
          record = undefined
        const now = this.now()
        if (
          record &&
          (record.updatedAt > now ||
            now - record.updatedAt >= HISTORY_RETAIN_MS)
        ) {
          record = { ...record, data: undefined, updatedAt: 0 }
        }
        record ??= { version: HISTORY_SCHEMA_VERSION, updatedAt: 0 }
        if (this.journal.get(this.mark(uid, kind)))
          record = { ...record, invalidated: true }
        this.records.set(kind, record)
        if (Array.isArray(record.data)) {
          this.client.setQueryData(historyKey(uid, kind), record.data, {
            updatedAt: record.updatedAt,
          })
          if (record.invalidated)
            this.client
              .getQueryCache()
              .find({ queryKey: historyKey(uid, kind), exact: true })
              ?.invalidate()
        }
      })
      this.initialized = true
      this.emit()
    })()
    return this.initialization
  }

  /** Run before ordinary collection invalidation, even if no history query exists in memory. */
  invalidate(filters?: InvalidateQueryFilters) {
    const uid = this.uid ?? this.journal.get("showseek:history:owner")
    if (!uid) return
    for (const kind of HISTORY_COLLECTIONS) {
      const key = historyKey(uid, kind)
      const prefix = filters?.queryKey
      if (
        prefix &&
        (!prefix.every((part, index) => part === key[index]) ||
          (filters?.exact && prefix.length !== key.length))
      )
        continue
      if (filters?.predicate) {
        const query = this.client
          .getQueryCache()
          .find({ queryKey: key, exact: true })
        if (!query || !filters.predicate(query)) continue
      }
      this.revisions.set(kind, (this.revisions.get(kind) ?? 0) + 1)
      this.journal.set(this.mark(uid, kind), "1")
      const record = this.records.get(kind)
      if (record) this.records.set(kind, { ...record, invalidated: true })
      void this.write(async () => {
        const stored = await this.storage.get(this.key(uid, kind))
        if (stored)
          await this.storage.put(this.key(uid, kind), {
            ...stored,
            invalidated: true,
          })
      })
    }
  }
  needsRefresh(uid: string, kind: HistoryCollection) {
    const record = this.records.get(kind)
    return (
      this.uid === uid &&
      (!record?.data ||
        record.invalidated ||
        this.now() - record.updatedAt >= HISTORY_FRESH_MS)
    )
  }
  manualAvailableAt() {
    const latest = Math.max(
      this.manualAt,
      ...[...this.records.values()].map((record) => record.updatedAt),
    )
    return latest ? latest + HISTORY_ATTEMPT_MS : 0
  }
  beginManualRefresh() {
    if (!this.uid || this.now() < this.manualAvailableAt()) return false
    this.manualAt = this.now()
    this.journal.set(
      `showseek:history:${this.uid}:manual`,
      String(this.manualAt),
    )
    this.emit()
    return true
  }
  availableAt(kind: HistoryCollection) {
    const record = this.records.get(kind)
    return Math.max(
      record?.attemptAt ? record.attemptAt + HISTORY_ATTEMPT_MS : 0,
      record?.failedAt ? record.failedAt + HISTORY_RETRY_MS : 0,
    )
  }

  async fetch<K extends HistoryCollection>(
    uid: string,
    kind: K,
    fetcher: () => Promise<HistorySource[K]>,
    signal: AbortSignal,
  ): Promise<HistorySource[K]> {
    if (uid !== this.uid) throw new CancelledError()
    await this.initialization
    const generation = this.generation
    const version = this.revisions.get(kind) ?? 0
    const check = () => {
      if (signal.aborted || uid !== this.uid || generation !== this.generation)
        throw new CancelledError()
    }
    check()
    const retryAt = this.availableAt(kind)
    if (this.now() < retryAt) throw new HistoryDeferredError(retryAt)
    const prior = this.records.get(kind) ?? {
      version: HISTORY_SCHEMA_VERSION,
      updatedAt: 0,
    }
    const started = { ...prior, attemptAt: this.now(), failedAt: undefined }
    this.records.set(kind, started)
    // Await the transaction before issuing the billable read.
    await this.write(() => this.storage.put(this.key(uid, kind), started))
    try {
      check()
      let data: HistorySource[K]
      try {
        data = await fetcher()
      } catch (error) {
        check()
        const code = (error as { code?: string })?.code ?? ""
        if (/permission-denied|unauthenticated/.test(code)) throw error
        // One bounded retry within the same persisted attempt.
        await new Promise((resolve) => setTimeout(resolve, 1000))
        check()
        data = await fetcher()
      }
      check()
      if ((this.revisions.get(kind) ?? 0) !== version)
        throw new HistoryDeferredError(this.now() + 1000)
      const next: HistoryRecord = {
        version: HISTORY_SCHEMA_VERSION,
        data,
        updatedAt: this.now(),
      }
      this.records.set(kind, next)
      await this.write(async () => {
        check()
        if ((this.revisions.get(kind) ?? 0) !== version) return
        await this.storage.put(this.key(uid, kind), next)
        if ((this.revisions.get(kind) ?? 0) === version)
          this.journal.remove(this.mark(uid, kind))
      })
      check()
      if ((this.revisions.get(kind) ?? 0) !== version)
        throw new HistoryDeferredError(this.now() + 1000)
      return data
    } catch (error) {
      if (generation === this.generation && uid === this.uid) {
        const next = {
          ...this.records.get(kind)!,
          attemptAt: undefined,
          failedAt:
            error instanceof CancelledError ||
            error instanceof HistoryDeferredError
              ? undefined
              : this.now(),
        }
        this.records.set(kind, next)
        await this.write(() => this.storage.put(this.key(uid, kind), next))
      }
      throw error
    } finally {
      this.emit()
    }
  }
}

const caches = new WeakMap<QueryClient, HistoryCache>()
export function getHistoryCache(client: QueryClient): HistoryCache {
  let cache = caches.get(client)
  if (cache) return cache
  cache = new HistoryCache(client)
  caches.set(client, cache)
  const invalidate = client.invalidateQueries.bind(client)
  client.invalidateQueries = ((
    ...args: Parameters<QueryClient["invalidateQueries"]>
  ) => {
    cache.invalidate(args[0])
    return invalidate(...args)
  }) as QueryClient["invalidateQueries"]
  return cache
}

"use client"

import { useAuth } from "@/context/auth-context"
import { HistoryCalculator, type HistorySource } from "@/lib/history/calculator"
import { getHistoryCache, HistoryDeferredError } from "@/lib/history/cache"
import {
  HISTORY_COLLECTIONS,
  HISTORY_FRESH_MS,
  HISTORY_RETAIN_MS,
  historyKey,
} from "@/lib/history/keys"
import { fetchHistoryCollection } from "@/lib/history/source"
import { useQueries, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState, useSyncExternalStore } from "react"

export function useHistory(genreMap: Record<number, string>, month?: string) {
  const { user, loading: authLoading } = useAuth()
  const uid = user && !user.isAnonymous ? user.uid : null
  const client = useQueryClient()
  const cache = getHistoryCache(client)
  useSyncExternalStore(cache.subscribe, cache.snapshot, () => 0)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!authLoading) void cache.selectUser(uid)
  }, [cache, uid, authLoading])
  const ready = !!uid && cache.isReady(uid) && !authLoading
  const queries = useQueries({
    queries: HISTORY_COLLECTIONS.map((kind) => ({
      queryKey: historyKey(uid ?? "__unauthenticated__", kind),
      queryFn: () =>
        cache.fetch(
          uid!,
          kind,
          () => fetchHistoryCollection(uid!, kind),
          new AbortController().signal,
        ),
      enabled: ready,
      staleTime: HISTORY_FRESH_MS,
      gcTime: HISTORY_RETAIN_MS,
      refetchOnMount: () =>
        ready && cache.needsRefresh(uid!, kind) ? ("always" as const) : false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: false, // The persisted attempt owns its single bounded retry.
    })),
  })
  const [episodes, ratings, lists] = queries.map((query) => query.data)
  const hasData = ready && queries.every((query) => query.data !== undefined)
  const fetching = queries.some((query) => query.isFetching)
  const error = queries.find(
    (query) => query.error && !(query.error instanceof HistoryDeferredError),
  )?.error
  const deferredUntil = Math.max(
    0,
    ...queries.map((q) =>
      q.error instanceof HistoryDeferredError ? q.error.retryAt : 0,
    ),
  )
  const retryAvailableAt = Math.max(
    0,
    ...HISTORY_COLLECTIONS.map((kind) => cache.availableAt(kind)),
  )
  const availableAt = error
    ? retryAvailableAt
    : Math.max(cache.manualAvailableAt(), retryAvailableAt)
  const cooldown = Math.max(0, Math.ceil((availableAt - now) / 1000))

  useEffect(() => {
    if (!ready || deferredUntil <= 0) return
    const timer = setTimeout(
      () => {
        for (const kind of HISTORY_COLLECTIONS) {
          const query = client.getQueryState(historyKey(uid!, kind))
          if (query?.error instanceof HistoryDeferredError) {
            void client.refetchQueries(
              { queryKey: historyKey(uid!, kind), exact: true, type: "active" },
              { cancelRefetch: false },
            )
          }
        }
      },
      Math.max(0, deferredUntil - Date.now()),
    )
    return () => clearTimeout(timer)
  }, [ready, deferredUntil, client, uid])
  useEffect(() => {
    if (availableAt <= Date.now()) return
    const timer = setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= availableAt) clearInterval(timer)
    }, 1000)
    return () => clearInterval(timer)
  }, [availableAt])
  // Reconcile the local clock after a suspended tab returns, even with fresh data.
  useEffect(() => {
    const updateClock = () => setNow(Date.now())
    window.addEventListener("focus", updateClock)
    document.addEventListener("visibilitychange", updateClock)
    return () => {
      window.removeEventListener("focus", updateClock)
      document.removeEventListener("visibilitychange", updateClock)
    }
  }, [])
  // Calendar calculations change at local midnight even if source data stays cached.
  useEffect(() => {
    const midnight = new Date()
    midnight.setHours(24, 0, 0, 0)
    const timer = setTimeout(
      () => setNow(Date.now()),
      midnight.getTime() - Date.now(),
    )
    return () => clearTimeout(timer)
  }, [now])

  const result = useMemo(() => {
    if (!hasData) return null
    const calculator = new HistoryCalculator(
      { episodes, ratings, lists } as HistorySource,
      now,
    )
    return {
      overview: calculator.overview(genreMap),
      detail: month ? calculator.detail(month, genreMap) : null,
    }
  }, [hasData, episodes, ratings, lists, genreMap, month, now])
  async function refresh() {
    if (!ready || fetching || Date.now() < availableAt) return
    if (!error && !cache.beginManualRefresh()) return
    setNow(Date.now())
    await Promise.all(
      queries
        .filter((query) => !error || query.error)
        .map((query) => query.refetch({ cancelRefetch: false })),
    )
  }
  return {
    ...result,
    loading: authLoading || !ready || (!hasData && !error),
    fetching,
    error,
    cooldown,
    refresh,
    deferred: deferredUntil > now,
  }
}

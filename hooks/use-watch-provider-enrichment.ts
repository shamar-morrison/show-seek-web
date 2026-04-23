"use client"

import { fetchWatchProviders } from "@/app/actions"
import { queryKeys } from "@/lib/react-query/query-keys"
import { createRateLimitedQueryFn } from "@/lib/react-query/rate-limited-query"
import type { SupportedRegionCode } from "@/lib/regions"
import type { ListMediaItem } from "@/types/list"
import type { WatchProviders } from "@/types/tmdb"
import { useQueries } from "@tanstack/react-query"
import { useMemo } from "react"

const WATCH_PROVIDER_STALE_TIME = 1000 * 60 * 60 * 24

interface WatchProviderEnrichmentTarget {
  id: number
  mediaType: "movie" | "tv"
}

export interface UseWatchProviderEnrichmentResult {
  providerMap: Map<string, WatchProviders | null>
  isLoadingEnrichment: boolean
  enrichmentProgress: number
}

function buildEnrichmentTargets(
  listItems: ListMediaItem[],
): WatchProviderEnrichmentTarget[] {
  const seen = new Set<string>()
  const targets: WatchProviderEnrichmentTarget[] = []

  for (const item of listItems) {
    const key = `${item.media_type}-${item.id}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    targets.push({
      id: item.id,
      mediaType: item.media_type,
    })
  }

  return targets
}

export function useWatchProviderEnrichment(
  listItems: ListMediaItem[],
  region: SupportedRegionCode,
  enabled: boolean,
): UseWatchProviderEnrichmentResult {
  const targets = useMemo(() => buildEnrichmentTargets(listItems), [listItems])

  const enrichmentQueries = useQueries({
    queries: targets.map((target) => ({
      queryKey: queryKeys.tmdb.watchProviders(
        region,
        target.mediaType,
        target.id,
      ),
      queryFn: createRateLimitedQueryFn(() =>
        fetchWatchProviders(target.id, target.mediaType, region),
      ),
      staleTime: WATCH_PROVIDER_STALE_TIME,
      gcTime: WATCH_PROVIDER_STALE_TIME,
      enabled: enabled && targets.length > 0,
    })),
  })

  const providerMap = useMemo(() => {
    const map = new Map<string, WatchProviders | null>()

    enrichmentQueries.forEach((query, index) => {
      const target = targets[index]
      if (!target) {
        return
      }

      const providerKey = `${target.mediaType}-${target.id}`
      if (!enabled) {
        map.set(providerKey, null)
      } else if (query.isSuccess) {
        map.set(providerKey, query.data ?? null)
      } else if (query.isError) {
        map.set(providerKey, null)
      }
    })

    return map
  }, [enabled, enrichmentQueries, targets])

  const completedCount = enabled
    ? enrichmentQueries.filter((query) => query.isSuccess || query.isError)
        .length
    : 0
  const enrichmentProgress =
    enabled && targets.length > 0 ? completedCount / targets.length : 0
  const isLoadingEnrichment =
    enabled && enrichmentQueries.some((query) => query.isLoading)

  return {
    providerMap,
    isLoadingEnrichment,
    enrichmentProgress,
  }
}

"use client"

import { fetchWatchProviderCatalog } from "@/app/actions"
import { PremiumModal } from "@/components/premium-modal"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { ImageWithFallback } from "@/components/ui/image-with-fallback"
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select"
import { useAuth } from "@/context/auth-context"
import { useLists } from "@/hooks/use-lists"
import { usePosterOverrides } from "@/hooks/use-poster-overrides"
import { usePreferences } from "@/hooks/use-preferences"
import { useWatchProviderEnrichment } from "@/hooks/use-watch-provider-enrichment"
import { listItemToMedia } from "@/lib/list-media"
import { getDisplayMediaTitle } from "@/lib/media-title"
import { isPremiumStatusPending } from "@/lib/premium-gating"
import { queryKeys } from "@/lib/react-query/query-keys"
import { buildImageUrl } from "@/lib/tmdb"
import { getMediaUrl } from "@/lib/utils"
import type { ListMediaItem, UserList } from "@/types/list"
import type { WatchProvider } from "@/types/tmdb"
import {
  CrownIcon,
  FolderLibraryIcon,
  Loading03Icon,
  Search01Icon,
  Tv01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useMemo, useState } from "react"

const PROVIDER_LIST_GC_TIME = Infinity

interface ListSelectOption extends SearchableSelectOption {
  itemCount: number
}

interface ServiceSelectOption extends SearchableSelectOption {
  matchCount: number
  provider: WatchProvider
}

function getItemCount(list: UserList): number {
  return Object.keys(list.items || {}).length
}

function formatItemCount(count: number): string {
  return count === 1 ? "1 item" : `${count} items`
}

function mergeProviders(
  movieProviders: WatchProvider[] = [],
  tvProviders: WatchProvider[] = [],
): WatchProvider[] {
  const providerMap = new Map<number, WatchProvider>()

  for (const provider of [...movieProviders, ...tvProviders]) {
    const existingProvider = providerMap.get(provider.provider_id)
    if (
      !existingProvider ||
      provider.display_priority < existingProvider.display_priority
    ) {
      providerMap.set(provider.provider_id, provider)
    }
  }

  return Array.from(providerMap.values()).sort(
    (a, b) => a.display_priority - b.display_priority,
  )
}

function SelectorShell({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
        {label}
      </span>
      {children}
    </div>
  )
}

function ProviderLogo({
  className,
  provider,
  testId,
}: {
  className?: string
  provider: WatchProvider
  testId?: string
}) {
  const logoUrl = buildImageUrl(provider.logo_path, "w92")

  if (!logoUrl) {
    return null
  }

  return <img src={logoUrl} alt="" data-testid={testId} className={className} />
}

function EmptyWhereToWatchState({
  description,
  icon = Tv01Icon,
  title,
}: {
  description: string
  icon?: typeof Tv01Icon
  title: string
}) {
  return (
    <Empty className="min-h-[360px] border border-white/10 bg-white/[0.03]">
      <EmptyMedia variant="icon" className="bg-primary/15 text-primary">
        <HugeiconsIcon icon={icon} className="size-7" />
      </EmptyMedia>
      <EmptyHeader>
        <EmptyTitle className="text-white">{title}</EmptyTitle>
        <EmptyDescription className="text-white/60">
          {description}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function WhereToWatchResultCard({
  item,
  providerLogoUrl,
  preferOriginalTitles,
}: {
  item: ListMediaItem
  providerLogoUrl: string | null
  preferOriginalTitles: boolean
}) {
  const { resolvePosterPath } = usePosterOverrides()
  const media = listItemToMedia(item)
  const title = getDisplayMediaTitle(media, preferOriginalTitles) || item.title
  const posterUrl = buildImageUrl(
    resolvePosterPath(item.media_type, item.id, item.poster_path),
    "w500",
  )
  const mediaTypeLabel = item.media_type === "movie" ? "Movie" : "TV Show"

  return (
    <Link
      href={getMediaUrl(item.media_type, item.id)}
      data-testid="where-to-watch-result-card"
      className="group block"
    >
      <div className="relative w-full overflow-hidden rounded-xl bg-card shadow-md transition-all duration-300">
        <div className="relative aspect-2/3 w-full overflow-hidden bg-gray-900">
          <ImageWithFallback
            src={posterUrl}
            alt={title}
            fallbackText=""
            imageClassName="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />

          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center rounded-md bg-black/80 px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-white backdrop-blur-sm">
              {mediaTypeLabel}
            </span>
          </div>

          {providerLogoUrl ? (
            <div className="absolute top-2 right-2 overflow-hidden rounded-md bg-white p-0.5 shadow-md ring-1 ring-black/10">
              <img
                src={providerLogoUrl}
                alt=""
                className="size-7 rounded-[4px] object-contain"
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-1 p-3">
          <h2 className="line-clamp-1 text-base font-bold text-white">
            {title}
          </h2>
          <span className="text-xs font-medium text-white/55">
            {mediaTypeLabel}
          </span>
        </div>
      </div>
    </Link>
  )
}

export function WhereToWatchPageClient() {
  const { isPremium, premiumLoading, premiumStatus } = useAuth()
  const {
    lists,
    loading: listsLoading,
    error: listsError,
    refetch,
  } = useLists()
  const { preferences, region } = usePreferences()
  const [selectedListId, setSelectedListId] = useState("")
  const [selectedService, setSelectedService] = useState<WatchProvider | null>(
    null,
  )
  const [showPremiumModal, setShowPremiumModal] = useState(false)

  const isPremiumPending = isPremiumStatusPending({
    premiumLoading,
    premiumStatus,
  })
  const canUseWhereToWatch = !isPremiumPending && isPremium

  const activeSelectedListId = useMemo(
    () =>
      lists.some((list) => list.id === selectedListId) ? selectedListId : "",
    [lists, selectedListId],
  )
  const selectedList = useMemo(
    () => lists.find((list) => list.id === activeSelectedListId) ?? null,
    [activeSelectedListId, lists],
  )
  const selectedListItems = useMemo(
    () =>
      selectedList
        ? Object.values(selectedList.items || {}).sort(
            (a, b) => (b.addedAt || 0) - (a.addedAt || 0),
          )
        : [],
    [selectedList],
  )

  const providerQueriesEnabled = !!selectedList && canUseWhereToWatch
  const movieProvidersQuery = useQuery({
    queryKey: queryKeys.tmdb.watchProviderCatalog(region, "movie"),
    queryFn: () => fetchWatchProviderCatalog("movie", region),
    staleTime: Infinity,
    gcTime: PROVIDER_LIST_GC_TIME,
    enabled: providerQueriesEnabled,
  })
  const tvProvidersQuery = useQuery({
    queryKey: queryKeys.tmdb.watchProviderCatalog(region, "tv"),
    queryFn: () => fetchWatchProviderCatalog("tv", region),
    staleTime: Infinity,
    gcTime: PROVIDER_LIST_GC_TIME,
    enabled: providerQueriesEnabled,
  })

  const { providerMap, isLoadingEnrichment } = useWatchProviderEnrichment(
    selectedListItems,
    region,
    providerQueriesEnabled,
  )

  const mergedProviders = useMemo(
    () => mergeProviders(movieProvidersQuery.data, tvProvidersQuery.data),
    [movieProvidersQuery.data, tvProvidersQuery.data],
  )

  const providerCounts = useMemo(() => {
    const counts = new Map<number, number>()

    for (const item of selectedListItems) {
      const providerKey = `${item.media_type}-${item.id}`
      const providers = providerMap.get(providerKey)?.flatrate || []
      const seenForItem = new Set<number>()

      for (const provider of providers) {
        if (seenForItem.has(provider.provider_id)) {
          continue
        }

        seenForItem.add(provider.provider_id)
        counts.set(
          provider.provider_id,
          (counts.get(provider.provider_id) || 0) + 1,
        )
      }
    }

    return counts
  }, [providerMap, selectedListItems])

  const visibleProviders = useMemo(() => {
    if (isLoadingEnrichment) {
      return mergedProviders
    }

    return mergedProviders.filter(
      (provider) => (providerCounts.get(provider.provider_id) || 0) > 0,
    )
  }, [isLoadingEnrichment, mergedProviders, providerCounts])

  const activeSelectedService = useMemo(() => {
    if (!selectedService) {
      return null
    }

    if (isLoadingEnrichment) {
      return selectedService
    }

    return (providerCounts.get(selectedService.provider_id) || 0) > 0
      ? selectedService
      : null
  }, [isLoadingEnrichment, providerCounts, selectedService])

  const selectedServiceLogoUrl = buildImageUrl(
    activeSelectedService?.logo_path || null,
    "w92",
  )

  const listOptions = useMemo<ListSelectOption[]>(
    () =>
      lists.map((list) => ({
        itemCount: getItemCount(list),
        label: list.name,
        value: list.id,
      })),
    [lists],
  )

  const serviceOptions = useMemo<ServiceSelectOption[]>(
    () =>
      visibleProviders.map((provider) => ({
        label: provider.provider_name,
        matchCount: providerCounts.get(provider.provider_id) || 0,
        provider,
        value: String(provider.provider_id),
      })),
    [providerCounts, visibleProviders],
  )

  const filteredItems = useMemo(() => {
    if (!activeSelectedService) {
      return []
    }

    return selectedListItems.filter((item) => {
      const providerKey = `${item.media_type}-${item.id}`
      return (
        providerMap
          .get(providerKey)
          ?.flatrate?.some(
            (provider) =>
              provider.provider_id === activeSelectedService.provider_id,
          ) ?? false
      )
    })
  }, [activeSelectedService, providerMap, selectedListItems])

  const hasProviderFetchError =
    movieProvidersQuery.isError || tvProvidersQuery.isError
  const isProviderFetchLoading =
    movieProvidersQuery.isLoading || tvProvidersQuery.isLoading

  function handleListSelect(listId: string) {
    setSelectedListId(listId)
  }

  function handleServiceSelect(providerId: string) {
    const provider = visibleProviders.find(
      (candidate) => String(candidate.provider_id) === providerId,
    )
    setSelectedService(provider ?? null)
  }

  const serviceSelectStatus = (() => {
    if (!selectedList) {
      return "Choose a list first"
    }

    if (!canUseWhereToWatch) {
      return isPremiumPending ? "Checking Premium..." : "Premium required"
    }

    if (hasProviderFetchError) {
      return "Unable to load services"
    }

    if (isProviderFetchLoading && visibleProviders.length === 0) {
      return "Loading services..."
    }

    if (visibleProviders.length === 0) {
      return "No services available"
    }

    return "Choose a service"
  })()

  const listSelectStatus = (() => {
    if (listsLoading) {
      return "Loading lists..."
    }

    if (listsError) {
      return "Unable to load lists"
    }

    if (lists.length === 0) {
      return "No lists available"
    }

    return "Choose a list"
  })()

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:flex-row">
          <SelectorShell label="List">
            <SearchableSelect
              value={activeSelectedListId || null}
              onChange={(value) => handleListSelect(value ?? "")}
              options={listOptions}
              placeholder={listSelectStatus}
              searchPlaceholder="Search lists..."
              emptyMessage="No lists found."
              disabled={listsLoading || !!listsError || lists.length === 0}
              triggerTestId="where-to-watch-list-selector"
              triggerClassName="h-12 w-full gap-2.5 rounded-xl border-white/10 bg-white/[0.04] px-3.5 text-sm font-semibold text-white shadow-none transition-colors hover:border-white/20 hover:bg-white/[0.07] focus-visible:border-primary/60 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
              popoverClassName="border border-white/10 bg-zinc-950 text-white"
              renderTriggerContent={(selectedOption, placeholder) => (
                <>
                  <HugeiconsIcon
                    icon={FolderLibraryIcon}
                    className="pointer-events-none size-4 shrink-0 text-primary"
                  />
                  <span className="min-w-0 truncate">
                    {selectedOption
                      ? `${selectedOption.label} (${formatItemCount(selectedOption.itemCount)})`
                      : placeholder}
                  </span>
                </>
              )}
              renderOption={(option) => (
                <span className="truncate">
                  {option.label} ({formatItemCount(option.itemCount)})
                </span>
              )}
            />
          </SelectorShell>

          <SelectorShell label="Streaming Service">
            <SearchableSelect
              value={
                activeSelectedService
                  ? String(activeSelectedService.provider_id)
                  : null
              }
              onChange={(value) => handleServiceSelect(value ?? "")}
              options={serviceOptions}
              placeholder={serviceSelectStatus}
              searchPlaceholder="Search services..."
              emptyMessage="No services found."
              disabled={
                !selectedList ||
                !canUseWhereToWatch ||
                hasProviderFetchError ||
                visibleProviders.length === 0
              }
              triggerTestId="where-to-watch-service-selector"
              triggerClassName="h-12 w-full gap-2.5 rounded-xl border-white/10 bg-white/[0.04] px-3.5 text-sm font-semibold text-white shadow-none transition-colors hover:border-white/20 hover:bg-white/[0.07] focus-visible:border-primary/60 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
              popoverClassName="border border-white/10 bg-zinc-950 text-white"
              renderTriggerContent={(selectedOption, placeholder) => (
                <>
                  {selectedOption ? (
                    <ProviderLogo
                      provider={selectedOption.provider}
                      testId="where-to-watch-selected-service-logo"
                      className="pointer-events-none size-6 shrink-0 rounded-md bg-white object-contain"
                    />
                  ) : (
                    <HugeiconsIcon
                      icon={Tv01Icon}
                      className="pointer-events-none size-4 shrink-0 text-primary"
                    />
                  )}
                  <span className="min-w-0 truncate">
                    {selectedOption ? selectedOption.label : placeholder}
                  </span>
                </>
              )}
              renderOption={(option) => (
                <>
                  <ProviderLogo
                    provider={option.provider}
                    testId={`where-to-watch-service-logo-${option.provider.provider_id}`}
                    className="size-7 rounded-md bg-white object-contain"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{option.label}</span>
                    {!isLoadingEnrichment ? (
                      <span className="text-xs font-normal text-white/45">
                        {formatItemCount(option.matchCount)}
                      </span>
                    ) : null}
                  </span>
                </>
              )}
            />
          </SelectorShell>
        </div>

        {listsError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-100">
              Couldn&apos;t load your lists.
            </p>
            <Button type="button" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : null}

        {selectedList && isLoadingEnrichment ? (
          <div
            data-testid="where-to-watch-enrichment-indicator"
            className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-white/45"
          >
            <HugeiconsIcon
              icon={Loading03Icon}
              className="size-4 animate-spin"
            />
            <span>Updating availability...</span>
          </div>
        ) : null}

        <div className="relative min-h-[360px]">
          {!selectedList ? (
            <EmptyWhereToWatchState
              title="Choose a list"
              description="Select one of your lists to start checking streaming availability."
              icon={FolderLibraryIcon}
            />
          ) : !canUseWhereToWatch ? (
            <EmptyWhereToWatchState
              title={
                isPremiumPending
                  ? "Checking Premium access"
                  : "Where to Watch is Premium"
              }
              description={
                isPremiumPending
                  ? "Availability controls will unlock as soon as your Premium status is confirmed."
                  : "Upgrade to compare streaming availability across the movies and shows in your lists."
              }
              icon={CrownIcon}
            />
          ) : hasProviderFetchError ? (
            <EmptyWhereToWatchState
              title="Unable to load streaming services"
              description="Try again later. Your lists are available, but the provider catalog could not be loaded."
              icon={Search01Icon}
            />
          ) : !activeSelectedService ? (
            <EmptyWhereToWatchState
              title="Choose a streaming service"
              description="Services are filtered to providers that have matches in the selected list."
            />
          ) : filteredItems.length === 0 ? (
            <EmptyWhereToWatchState
              title="No matches found"
              description={`${activeSelectedService.provider_name} has no streaming matches in ${selectedList.name} for ${region}.`}
              icon={Search01Icon}
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filteredItems.map((item) => (
                <WhereToWatchResultCard
                  key={`${item.media_type}-${item.id}`}
                  item={item}
                  providerLogoUrl={selectedServiceLogoUrl}
                  preferOriginalTitles={preferences.showOriginalTitles}
                />
              ))}
            </div>
          )}
        </div>

        {!canUseWhereToWatch && selectedList && !isPremiumPending ? (
          <div
            data-testid="where-to-watch-premium-overlay"
            className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-amber-400">
                  <HugeiconsIcon icon={CrownIcon} className="size-5" />
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                    Premium
                  </span>
                </div>
                <p className="text-sm text-white/68">
                  Unlock streaming availability across your saved lists.
                </p>
              </div>
              <Button
                type="button"
                data-testid="where-to-watch-upgrade-button"
                onClick={() => setShowPremiumModal(true)}
              >
                Upgrade to Premium
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <PremiumModal
        open={showPremiumModal}
        onOpenChange={setShowPremiumModal}
      />
    </>
  )
}

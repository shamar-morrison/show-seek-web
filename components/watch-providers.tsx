import { buildImageUrl } from "@/lib/tmdb"
import type {
  WatchProvider,
  WatchProviders as WatchProvidersType,
} from "@/types/tmdb"

interface WatchProvidersProps {
  /** Watch providers data from TMDB */
  providers: WatchProvidersType | null
}

/**
 * ProviderLogo Component
 * Individual provider logo with hover effect and link to JustWatch
 */
function ProviderLogo({
  provider,
  link,
}: {
  provider: WatchProvider
  link: string
}) {
  const logoUrl = buildImageUrl(provider.logo_path, "w92")

  if (!logoUrl) return null

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      title={provider.provider_name}
      className="group relative shrink-0"
    >
      <img
        src={logoUrl}
        alt={provider.provider_name}
        width={45}
        height={45}
        className="rounded-lg transition-transform duration-200 group-hover:scale-110"
      />
    </a>
  )
}

/**
 * ProviderSection Component
 * Section for a specific provider type (Stream, Rent, Buy)
 */
function ProviderSection({
  title,
  providers,
  link,
}: {
  title: string
  providers: WatchProvider[]
  link: string
}) {
  if (!providers || providers.length === 0) return null

  // Sort by display_priority (lower is higher priority)
  const sortedProviders = [...providers].sort(
    (a, b) => a.display_priority - b.display_priority,
  )

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-gray-400">{title}</span>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
        {sortedProviders.map((provider) => (
          <ProviderLogo
            key={provider.provider_id}
            provider={provider}
            link={link}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * WatchProviders Component
 * Displays streaming, rental, and purchase providers for a media item
 * Links to JustWatch for attribution
 */
export function WatchProviders({ providers }: WatchProvidersProps) {
  // Return null if no providers available
  if (!providers) return null

  const hasAnyProviders =
    (providers.flatrate && providers.flatrate.length > 0) ||
    (providers.rent && providers.rent.length > 0) ||
    (providers.buy && providers.buy.length > 0)

  if (!hasAnyProviders) return null

  return (
    <section className="py-8">
      {/* Header */}
      <div className="mx-auto mb-4 flex max-w-[1800px] items-end justify-between px-4 sm:px-8 lg:px-12">
        <h2 className="text-xl font-bold text-white sm:text-2xl">
          Where to Watch
        </h2>
      </div>

      {/* Provider Sections */}
      <div className="mx-auto max-w-[1800px] px-4 sm:px-8 lg:px-12">
        <div className="flex flex-col gap-6 sm:flex-row sm:gap-12">
          {/* Streaming (flatrate) - shown first with priority */}
          {providers.flatrate && providers.flatrate.length > 0 && (
            <ProviderSection
              title="Stream"
              providers={providers.flatrate}
              link={providers.link}
            />
          )}

          {/* Rent */}
          {providers.rent && providers.rent.length > 0 && (
            <ProviderSection
              title="Rent"
              providers={providers.rent}
              link={providers.link}
            />
          )}

          {/* Buy */}
          {providers.buy && providers.buy.length > 0 && (
            <ProviderSection
              title="Buy"
              providers={providers.buy}
              link={providers.link}
            />
          )}
        </div>

        {/* JustWatch Attribution */}
        <p className="mt-6 text-xs text-gray-500">
          Streaming data provided by{" "}
          <a
            href={providers.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 underline hover:text-white"
          >
            JustWatch
          </a>
        </p>
      </div>
    </section>
  )
}

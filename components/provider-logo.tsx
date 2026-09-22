import { buildImageUrl } from "@/lib/tmdb"

interface ProviderLogoProps {
  provider: {
    logo_path: string | null
    provider_name: string
  }
  className?: string
  testId?: string
  /** When true, renders alt="" for decorative contexts (dropdowns, badges). */
  decorative?: boolean
  width?: number
  height?: number
}

/**
 * Shared streaming provider logo.
 *
 * Single owner of the `buildImageUrl(logo_path, "w92")` resolution and
 * null handling. All surfaces (detail-page WatchProviders, Where-to-Watch
 * selectors/cards, Discover Streaming filter) resolve to the identical TMDB
 * CDN URL, so browser HTTP cache serves repeat loads without extra caching
 * code.
 */
export function ProviderLogo({
  provider,
  className,
  testId,
  decorative = false,
  width,
  height,
}: ProviderLogoProps) {
  const logoUrl = buildImageUrl(provider.logo_path, "w92")

  if (!logoUrl) {
    return null
  }

  return (
    <img
      src={logoUrl}
      alt={decorative ? "" : provider.provider_name}
      width={width}
      height={height}
      loading="lazy"
      data-testid={testId}
      className={className}
    />
  )
}

import type { TMDBMovieDetails, TMDBTVDetails } from "@/types/tmdb"

interface MediaDetailsProps {
  /** Media details */
  media: TMDBMovieDetails | TMDBTVDetails
  /** Media type */
  mediaType: "movie" | "tv"
}

/**
 * Get language name from ISO code using Intl API
 */
function getLanguageName(isoCode: string): string {
  try {
    const displayName = new Intl.DisplayNames(["en"], { type: "language" })
    return displayName.of(isoCode) || isoCode.toUpperCase()
  } catch {
    return isoCode.toUpperCase()
  }
}

/**
 * Format runtime to hours and minutes
 */
function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

/**
 * Get US certification from movie release dates
 */
function getMovieCertification(media: TMDBMovieDetails): string | null {
  const usRelease = media.release_dates?.results?.find(
    (r) => r.iso_3166_1 === "US",
  )
  if (!usRelease) return null

  // Find theatrical or general release with certification
  const release = usRelease.release_dates.find(
    (rd) => rd.certification && rd.certification.trim() !== "",
  )
  return release?.certification || null
}

/**
 * Get US certification from TV content ratings
 */
function getTVCertification(media: TMDBTVDetails): string | null {
  const usRating = media.content_ratings?.results?.find(
    (r) => r.iso_3166_1 === "US",
  )
  return usRating?.rating || null
}

/**
 * MediaDetails Component
 * Displays a grid of metadata about the media
 */
export function MediaDetails({ media, mediaType }: MediaDetailsProps) {
  const isMovie = mediaType === "movie"
  const movieData = isMovie ? (media as TMDBMovieDetails) : null
  const tvData = !isMovie ? (media as TMDBTVDetails) : null

  // Get display title and original title
  const displayTitle = isMovie ? movieData!.title : tvData!.name
  const originalTitle = isMovie
    ? movieData!.original_title
    : tvData!.original_name

  // Only show original title if different from display title
  const showOriginalTitle = originalTitle && originalTitle !== displayTitle

  // Get runtime (movie has single runtime, TV has array)
  const runtime = isMovie
    ? movieData!.runtime
    : tvData!.episode_run_time?.[0] || null

  // Get certification based on media type
  const certification = isMovie
    ? getMovieCertification(movieData!)
    : getTVCertification(tvData!)

  // Get production countries as a comma-separated string
  const productionCountries = media.production_countries
    ?.map((c) => c.name)
    .join(", ")

  // Get production companies as a comma-separated string
  const productionCompanies = media.production_companies
    ?.map((c) => c.name)
    .join(", ")

  // Get original language name
  const originalLanguage = media.original_language
    ? getLanguageName(media.original_language)
    : null

  // Build details array, filtering out empty values
  const details: { label: string; value: string }[] = []

  if (showOriginalTitle) {
    details.push({ label: "Original Title", value: originalTitle })
  }
  if (media.status) {
    details.push({ label: "Status", value: media.status })
  }
  if (runtime) {
    details.push({ label: "Runtime", value: formatRuntime(runtime) })
  }
  if (originalLanguage) {
    details.push({ label: "Original Language", value: originalLanguage })
  }
  if (productionCountries) {
    details.push({ label: "Production Countries", value: productionCountries })
  }
  if (certification) {
    details.push({ label: "Certification", value: certification })
  }
  if (productionCompanies) {
    details.push({ label: "Production Companies", value: productionCompanies })
  }

  // Don't render if no details to show
  if (details.length === 0) return null

  return (
    <section className="py-8">
      <div className="mx-auto max-w-[1800px] px-4 sm:px-8 lg:px-12">
        {/* Section Header */}
        <h2 className="mb-6 text-xl font-bold text-white sm:text-2xl">
          Details
        </h2>

        {/* Details Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {details.map((detail) => (
            <div key={detail.label} className="rounded-lg bg-card p-4">
              <dt className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">
                {detail.label}
              </dt>
              <dd className="text-sm text-white">{detail.value}</dd>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

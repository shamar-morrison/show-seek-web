import { formatTmdbDate } from "@/lib/tmdb-date"
import type { TMDBTVDetails } from "@/types/tmdb"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"

type UpNextEpisode = NonNullable<TMDBTVDetails["next_episode_to_air"]>

interface UpNextEpisodeCardProps {
  tvShowId: number
  episode: UpNextEpisode
}

/**
 * Visibility guard mirroring mobile TVDetailScreen: only actively ongoing
 * shows with a valid next episode to air.
 */
export function shouldShowUpNextEpisode(
  mediaType: "movie" | "tv",
  media: TMDBTVDetails,
): media is TMDBTVDetails & { next_episode_to_air: UpNextEpisode } {
  const next = media.next_episode_to_air

  return (
    mediaType === "tv" &&
    !!next?.air_date &&
    (media.status === "Returning Series" || media.status === "In Production") &&
    Number.isInteger(next.season_number) &&
    Number.isInteger(next.episode_number) &&
    next.episode_number > 0
  )
}

/**
 * "Up Next" card showing the next episode to air for an ongoing show.
 * Mirrors the mobile UpNextEpisodeSection: still thumbnail (omitted when
 * missing), accent "Up Next" label, title, S/E + air date subtitle.
 */
export function UpNextEpisodeCard({
  tvShowId,
  episode,
}: UpNextEpisodeCardProps) {
  const href = `/tv/${tvShowId}/season/${episode.season_number}/episode/${episode.episode_number}`
  const subtitle = `S${episode.season_number}E${episode.episode_number} • ${
    episode.air_date ? formatTmdbDate(episode.air_date) : "TBA"
  }`

  return (
    <Link
      href={href}
      aria-label={`Up Next: ${episode.name}`}
      className="inline-flex w-fit max-w-full items-center gap-3 self-center rounded-xl border border-primary/50 bg-[#121212]/90 p-2.5 backdrop-blur transition-colors hover:border-primary hover:bg-[#1a1a1a] sm:max-w-lg lg:self-start"
    >
      {episode.still_path ? (
        <img
          src={`https://image.tmdb.org/t/p/w300${episode.still_path}`}
          alt=""
          className="h-[57px] w-[101px] shrink-0 rounded-lg bg-[#232323] object-cover"
          sizes="101px"
        />
      ) : (
        <div className="flex h-[57px] w-[101px] shrink-0 items-center justify-center rounded-lg bg-gray-800 text-[10px] font-medium text-gray-500">
          No Image
        </div>
      )}
      <span className="flex min-w-0 flex-col justify-center gap-0.5 text-left">
        <span className="text-xs font-semibold text-primary">Up Next</span>
        <span className="text-[17px] font-bold break-words text-white">
          {episode.name}
        </span>
        <span className="text-xs whitespace-nowrap text-gray-400">{subtitle}</span>
      </span>
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        className="size-4 shrink-0 text-gray-500 opacity-60"
      />
    </Link>
  )
}

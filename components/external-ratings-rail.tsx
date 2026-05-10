"use client"

import { cn } from "@/lib/utils"
import type { ExternalRatings } from "@/types/external-ratings"

interface ExternalRatingsRailProps {
  ratings: ExternalRatings | null
  className?: string
}

const EXTERNAL_RATING_SOURCES = {
  imdb: {
    label: "IMDb",
    logoClassName: "h-5 w-auto sm:h-6",
    logoSrc: "/imdb-logo.png",
  },
  metacritic: {
    label: "Metacritic",
    logoClassName: "h-5 w-auto sm:h-6",
    logoSrc: "/metacritic-logo.png",
  },
  rottenTomatoes: {
    label: "Rotten Tomatoes",
    logoClassName: "h-6 w-auto",
    logoSrc: "/rotten-tomatoes-logo.png",
  },
} as const

function getExternalRatingItems(ratings: ExternalRatings) {
  const items: Array<{
    key: string
    label: string
    logoClassName: string
    logoSrc: string
    value: string
  }> = []

  if (ratings.imdb) {
    items.push({
      key: "imdb",
      label: EXTERNAL_RATING_SOURCES.imdb.label,
      logoClassName: EXTERNAL_RATING_SOURCES.imdb.logoClassName,
      logoSrc: EXTERNAL_RATING_SOURCES.imdb.logoSrc,
      value: `${ratings.imdb.rating}/10`,
    })
  }

  if (ratings.rottenTomatoes) {
    items.push({
      key: "rotten-tomatoes",
      label: EXTERNAL_RATING_SOURCES.rottenTomatoes.label,
      logoClassName: EXTERNAL_RATING_SOURCES.rottenTomatoes.logoClassName,
      logoSrc: EXTERNAL_RATING_SOURCES.rottenTomatoes.logoSrc,
      value: ratings.rottenTomatoes,
    })
  }

  if (ratings.metacritic) {
    items.push({
      key: "metacritic",
      label: EXTERNAL_RATING_SOURCES.metacritic.label,
      logoClassName: EXTERNAL_RATING_SOURCES.metacritic.logoClassName,
      logoSrc: EXTERNAL_RATING_SOURCES.metacritic.logoSrc,
      value: ratings.metacritic,
    })
  }

  return items
}

export function ExternalRatingsRail({
  ratings,
  className,
}: ExternalRatingsRailProps) {
  if (!ratings) {
    return null
  }

  const items = getExternalRatingItems(ratings)
  if (items.length === 0) {
    return null
  }

  return (
    <div
      className={cn(
        "animate-in fade-in-0 slide-in-from-bottom-2 duration-500",
        className,
      )}
      data-testid="external-ratings-rail"
    >
      <div className="flex max-w-3xl flex-col divide-y divide-white/10 sm:flex-row sm:items-center sm:divide-x sm:divide-y-0">
        {items.map((item) => (
          <div
            key={item.key}
            className="group flex items-center justify-center gap-3 py-3 sm:px-5 sm:py-1 first:sm:pl-0 last:sm:pr-0 lg:justify-start"
          >
            <img
              src={item.logoSrc}
              alt=""
              aria-hidden="true"
              className={cn(
                "w-auto object-contain opacity-90 transition-opacity duration-200 group-hover:opacity-100",
                item.logoClassName,
              )}
            />
            <div className="flex min-w-0 flex-col text-center lg:text-left">
              <span className="text-base font-semibold tracking-[-0.02em] text-white/95 transition-colors duration-200 group-hover:text-white">
                {item.value}
              </span>
              <span className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-white/45">
                {item.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

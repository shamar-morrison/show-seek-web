"use client"

import type { ActionMenuItem } from "@/components/ui/action-menu"
import {
  buildOpenWithUrl,
  OPEN_WITH_SERVICES,
  type OpenWithServiceId,
} from "@/lib/open-with-links"
import { Globe02Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useMemo, useRef } from "react"

interface UseOpenWithItemsParams {
  mediaType: "movie" | "tv"
  mediaId: number
  title: string
  year?: string | null
}

interface OpenWithIds {
  imdbId: string | null
  traktSlug: string | null
}

/**
 * Brand artwork per service. Image brands reuse the mobile app's logos
 * (served from `public/` as static assets); Wikipedia/Web Search use
 * Hugeicons glyphs like mobile's Globe/Search affordances.
 */
const SERVICE_ICON_SRC: Partial<Record<OpenWithServiceId, string>> = {
  imdb: "/imdb-logo.png",
  trakt: "/trakt-logo.svg",
  tmdb: "/tmdb-logo.png",
  letterboxd: "/letterboxd-logo.png",
  rottenTomatoes: "/rotten-tomatoes-logo.png",
  metacritic: "/metacritic-logo.png",
}

function ServiceIcon({ serviceId }: { serviceId: OpenWithServiceId }) {
  const src = SERVICE_ICON_SRC[serviceId]

  if (src) {
    return <img src={src} alt="" aria-hidden="true" />
  }

  if (serviceId === "wikipedia") {
    return <HugeiconsIcon icon={Globe02Icon} />
  }

  return <HugeiconsIcon icon={Search01Icon} />
}

/**
 * Builds "Open with" menu items for external service links.
 * Direct-link IDs resolve lazily via `/api/open-with` (no-store, zero KV
 * usage) on first use; search-fallback URLs work immediately if the lookup
 * fails or is still in flight.
 */
export function useOpenWithItems({
  mediaType,
  mediaId,
  title,
  year,
}: UseOpenWithItemsParams): ActionMenuItem[] {
  const idsRef = useRef<OpenWithIds | null>(null)
  const idsPromiseRef = useRef<Promise<OpenWithIds> | null>(null)

  const resolveIds = useCallback(async (): Promise<OpenWithIds> => {
    if (idsRef.current) {
      return idsRef.current
    }

    if (!idsPromiseRef.current) {
      idsPromiseRef.current = fetch(
        `/api/open-with?mediaType=${mediaType}&mediaId=${mediaId}`,
      )
        .then((response) =>
          response.ok
            ? (response.json() as Promise<OpenWithIds>)
            : { imdbId: null, traktSlug: null },
        )
        .catch(() => ({ imdbId: null, traktSlug: null }))
        .then((ids) => {
          idsRef.current = {
            imdbId: ids.imdbId ?? null,
            traktSlug: ids.traktSlug ?? null,
          }
          return idsRef.current
        })
    }

    return idsPromiseRef.current
  }, [mediaId, mediaType])

  const openService = useCallback(
    async (serviceId: OpenWithServiceId) => {
      const ids = await resolveIds()
      const url = buildOpenWithUrl({
        serviceId,
        mediaType,
        mediaId,
        title,
        year,
        imdbId: ids.imdbId,
        traktSlug: ids.traktSlug,
      })
      window.open(url, "_blank", "noopener,noreferrer")
    },
    [mediaId, mediaType, resolveIds, title, year],
  )

  return useMemo<ActionMenuItem[]>(
    () =>
      OPEN_WITH_SERVICES.map((service) => ({
        type: "action" as const,
        key: `open-with-${service.id}`,
        label: service.label,
        icon: <ServiceIcon serviceId={service.id} />,
        onClick: () => void openService(service.id),
      })),
    [openService],
  )
}

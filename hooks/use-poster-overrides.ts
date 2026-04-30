"use client"

import { usePreferences } from "@/hooks/use-preferences"
import {
  resolvePosterPath as resolvePosterPathForMedia,
  sanitizePosterOverrides,
  type PosterOverrideMediaType,
} from "@/lib/poster-overrides"
import { useCallback, useMemo } from "react"

export function usePosterOverrides() {
  const { preferences } = usePreferences()

  const overrides = useMemo(
    () => sanitizePosterOverrides(preferences.posterOverrides),
    [preferences.posterOverrides],
  )

  const resolvePosterPath = useCallback(
    (
      mediaType: PosterOverrideMediaType,
      mediaId: number,
      fallbackPosterPath: string | null | undefined,
    ) =>
      resolvePosterPathForMedia(
        overrides,
        mediaType,
        mediaId,
        fallbackPosterPath,
      ),
    [overrides],
  )

  return {
    overrides,
    resolvePosterPath,
  }
}

import { isAccentColor } from "@/lib/accent-colors"
import {
  DEFAULT_PREFERENCES,
  hydrateUserPreferences,
  type StoredUserPreferences,
  type UserPreferences,
} from "@/lib/user-preferences"
import { resolveUserRegion, type SupportedRegionCode } from "@/lib/regions"

interface PreferencesCacheSource {
  preferences?: StoredUserPreferences
  region?: string
  /**
   * Top-level accent color written by the mobile app
   * (`users/{uid}.accentColor`). Web reads it as a fallback so a color
   * picked on mobile appears on web after a refresh, and vice versa —
   * web dual-writes both locations.
   */
  accentColor?: string
}

export interface PreferencesCacheData {
  preferences: UserPreferences
  region: SupportedRegionCode
}

export function getDefaultPreferencesCacheData(): PreferencesCacheData {
  return {
    preferences: DEFAULT_PREFERENCES,
    region: resolveUserRegion(undefined),
  }
}

export function mapPreferencesCacheData(
  source?: PreferencesCacheSource,
): PreferencesCacheData {
  const preferences = hydrateUserPreferences(source?.preferences)
  // Mobile only writes the top-level field, so fall back to it when no
  // nested preference is stored. Check the raw values (not the hydrated
  // result) so an explicit "Red" pick isn't mistaken for "absent".
  const nestedRaw = source?.preferences?.accentColor
  const hasNested =
    typeof nestedRaw === "string" && isAccentColor(nestedRaw)
  if (
    !hasNested &&
    typeof source?.accentColor === "string" &&
    isAccentColor(source.accentColor)
  ) {
    preferences.accentColor = source.accentColor
  }
  return {
    preferences,
    region: resolveUserRegion(source?.region),
  }
}

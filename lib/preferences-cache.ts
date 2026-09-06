import {
  DEFAULT_ACCENT_COLOR,
  resolveAccentColor,
} from "@/lib/accent-colors"
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
   * Top-level accent color owned by the mobile app
   * (`users/{uid}.accentColor`). The web reads and writes this same field
   * so both apps stay in sync — there is no nested copy.
   */
  accentColor?: string
}

export interface PreferencesCacheData {
  preferences: UserPreferences
  region: SupportedRegionCode
  accentColor: string
}

export function getDefaultPreferencesCacheData(): PreferencesCacheData {
  return {
    preferences: DEFAULT_PREFERENCES,
    region: resolveUserRegion(undefined),
    accentColor: DEFAULT_ACCENT_COLOR,
  }
}

export function mapPreferencesCacheData(
  source?: PreferencesCacheSource,
): PreferencesCacheData {
  return {
    preferences: hydrateUserPreferences(source?.preferences),
    region: resolveUserRegion(source?.region),
    accentColor: resolveAccentColor(source?.accentColor),
  }
}

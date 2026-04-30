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
  return {
    preferences: hydrateUserPreferences(source?.preferences),
    region: resolveUserRegion(source?.region),
  }
}

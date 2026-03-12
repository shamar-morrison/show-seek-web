export const SUPPORTED_REGION_CODES = [
  "AR",
  "AU",
  "AT",
  "BE",
  "BR",
  "CA",
  "CL",
  "CO",
  "CZ",
  "DK",
  "FI",
  "FR",
  "DE",
  "GR",
  "HK",
  "HU",
  "IN",
  "ID",
  "IE",
  "IL",
  "IT",
  "JP",
  "MY",
  "MX",
  "NL",
  "NZ",
  "NO",
  "PE",
  "PH",
  "PL",
  "PT",
  "RO",
  "RU",
  "SG",
  "ZA",
  "KR",
  "ES",
  "SE",
  "CH",
  "TW",
  "TH",
  "TR",
  "UA",
  "GB",
  "US",
  "VN",
] as const

export type SupportedRegionCode = (typeof SUPPORTED_REGION_CODES)[number]

export const DEFAULT_REGION: SupportedRegionCode = "US"

const SUPPORTED_REGION_CODE_SET = new Set<string>(SUPPORTED_REGION_CODES)

// Use resolveUserRegion when callers need case-insensitive input handling.
export function isSupportedRegionCode(
  value: string | null | undefined,
): value is SupportedRegionCode {
  return !!value && SUPPORTED_REGION_CODE_SET.has(value)
}

export function resolveUserRegion(
  value: string | null | undefined,
): SupportedRegionCode {
  if (!value) {
    return DEFAULT_REGION
  }

  const normalizedValue = value.toUpperCase()
  return isSupportedRegionCode(normalizedValue)
    ? normalizedValue
    : DEFAULT_REGION
}

export const SUPPORTED_REGIONS = [
  { code: "AR", name: "Argentina", emoji: "🇦🇷" },
  { code: "AU", name: "Australia", emoji: "🇦🇺" },
  { code: "AT", name: "Austria", emoji: "🇦🇹" },
  { code: "BE", name: "Belgium", emoji: "🇧🇪" },
  { code: "BR", name: "Brazil", emoji: "🇧🇷" },
  { code: "CA", name: "Canada", emoji: "🇨🇦" },
  { code: "CL", name: "Chile", emoji: "🇨🇱" },
  { code: "CO", name: "Colombia", emoji: "🇨🇴" },
  { code: "CZ", name: "Czech Republic", emoji: "🇨🇿" },
  { code: "DK", name: "Denmark", emoji: "🇩🇰" },
  { code: "FI", name: "Finland", emoji: "🇫🇮" },
  { code: "FR", name: "France", emoji: "🇫🇷" },
  { code: "DE", name: "Germany", emoji: "🇩🇪" },
  { code: "GR", name: "Greece", emoji: "🇬🇷" },
  { code: "HK", name: "Hong Kong", emoji: "🇭🇰" },
  { code: "HU", name: "Hungary", emoji: "🇭🇺" },
  { code: "IN", name: "India", emoji: "🇮🇳" },
  { code: "ID", name: "Indonesia", emoji: "🇮🇩" },
  { code: "IE", name: "Ireland", emoji: "🇮🇪" },
  { code: "IL", name: "Israel", emoji: "🇮🇱" },
  { code: "IT", name: "Italy", emoji: "🇮🇹" },
  { code: "JP", name: "Japan", emoji: "🇯🇵" },
  { code: "MY", name: "Malaysia", emoji: "🇲🇾" },
  { code: "MX", name: "Mexico", emoji: "🇲🇽" },
  { code: "NL", name: "Netherlands", emoji: "🇳🇱" },
  { code: "NZ", name: "New Zealand", emoji: "🇳🇿" },
  { code: "NO", name: "Norway", emoji: "🇳🇴" },
  { code: "PE", name: "Peru", emoji: "🇵🇪" },
  { code: "PH", name: "Philippines", emoji: "🇵🇭" },
  { code: "PL", name: "Poland", emoji: "🇵🇱" },
  { code: "PT", name: "Portugal", emoji: "🇵🇹" },
  { code: "RO", name: "Romania", emoji: "🇷🇴" },
  { code: "RU", name: "Russia", emoji: "🇷🇺" },
  { code: "SG", name: "Singapore", emoji: "🇸🇬" },
  { code: "ZA", name: "South Africa", emoji: "🇿🇦" },
  { code: "KR", name: "South Korea", emoji: "🇰🇷" },
  { code: "ES", name: "Spain", emoji: "🇪🇸" },
  { code: "SE", name: "Sweden", emoji: "🇸🇪" },
  { code: "CH", name: "Switzerland", emoji: "🇨🇭" },
  { code: "TW", name: "Taiwan", emoji: "🇹🇼" },
  { code: "TH", name: "Thailand", emoji: "🇹🇭" },
  { code: "TR", name: "Turkey", emoji: "🇹🇷" },
  { code: "UA", name: "Ukraine", emoji: "🇺🇦" },
  { code: "GB", name: "United Kingdom", emoji: "🇬🇧" },
  { code: "US", name: "United States", emoji: "🇺🇸" },
  { code: "VN", name: "Vietnam", emoji: "🇻🇳" },
] as const

export type SupportedRegionCode = (typeof SUPPORTED_REGIONS)[number]["code"]

export const SUPPORTED_REGION_CODES = SUPPORTED_REGIONS.map(
  (region) => region.code,
) as readonly SupportedRegionCode[]

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

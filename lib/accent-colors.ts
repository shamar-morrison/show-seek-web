/**
 * Accent color palette shared with the mobile app.
 * Keep name/value pairs in sync with
 * `show-seek/src/constants/accentColors.ts`.
 */

export const DEFAULT_ACCENT_COLOR = "#E50914"

export const ACCENT_COLORS = [
  { name: "Amber", value: "#F59E0B" },
  { name: "Blue", value: "#3B82F6" },
  { name: "Cyan", value: "#06B6D4" },
  { name: "Emerald", value: "#10B981" },
  { name: "Fuchsia", value: "#D946EF" },
  { name: "Green", value: "#22C55E" },
  { name: "Indigo", value: "#6366F1" },
  { name: "Lime", value: "#84CC16" },
  { name: "Orange", value: "#F97316" },
  { name: "Pink", value: "#EC4899" },
  { name: "Purple", value: "#A855F7" },
  { name: "Red", value: "#E50914" },
  { name: "Rose", value: "#F43F5E" },
  { name: "Sky", value: "#0EA5E9" },
  { name: "Teal", value: "#14B8A6" },
  { name: "Violet", value: "#8B5CF6" },
  { name: "Yellow", value: "#EAB308" },
] as const

export type AccentColorOption = (typeof ACCENT_COLORS)[number]

export function getAccentColorName(value: string): string {
  return ACCENT_COLORS.find((color) => color.value === value)?.name ?? "Red"
}

export function isAccentColor(value: string): boolean {
  return ACCENT_COLORS.some((color) => color.value === value)
}

/** Validate a stored value, falling back to the default when invalid. */
export function resolveAccentColor(value: unknown): string {
  return typeof value === "string" && isAccentColor(value)
    ? value
    : DEFAULT_ACCENT_COLOR
}

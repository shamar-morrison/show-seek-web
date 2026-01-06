import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function safeParseInt(
  value: string | number | undefined | null,
): number | undefined {
  if (value === undefined || value === null) return undefined
  const parsed = parseInt(String(value), 10)
  return isNaN(parsed) ? undefined : parsed
}

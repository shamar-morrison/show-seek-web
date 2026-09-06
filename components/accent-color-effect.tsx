"use client"

import { usePreferences } from "@/hooks/use-preferences"
import { useEffect } from "react"

/**
 * Applies the user's accent color to the `--primary` CSS variable so every
 * `bg-primary` / `text-primary` / `border-primary` / `ring-primary` utility
 * (including opacity modifiers via `color-mix`) follows it with no
 * per-component changes. Also keeps the `theme-color` meta tag in sync.
 */
export function AccentColorEffect() {
  const { accentColor } = usePreferences()

  useEffect(() => {
    document.documentElement.style.setProperty("--primary", accentColor)
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", accentColor)
  }, [accentColor])

  return null
}

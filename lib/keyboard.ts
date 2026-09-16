import type { KeyboardEvent } from "react"

/**
 * Check if a keyboard event is Cmd+Enter (macOS) or Ctrl+Enter (Windows/Linux).
 * Used to confirm/save dialogs from multiline text inputs where plain Enter
 * inserts a newline.
 */
export function isModEnter(event: KeyboardEvent<{ value?: unknown }>): boolean {
  return event.key === "Enter" && (event.metaKey || event.ctrlKey)
}

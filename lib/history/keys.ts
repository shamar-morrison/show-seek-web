import { queryKeys } from "@/lib/react-query/query-keys"
import type { HistorySource } from "./calculator"
export type HistoryCollection = keyof HistorySource
export const HISTORY_COLLECTIONS: HistoryCollection[] = [
  "episodes",
  "ratings",
  "lists",
]
export function historyBaseKey(uid: string, kind: HistoryCollection) {
  return kind === "episodes"
    ? queryKeys.firestore.episodeTrackingAll(uid)
    : queryKeys.firestore[kind](uid)
}
export function historyKey(uid: string, kind: HistoryCollection) {
  return [...historyBaseKey(uid, kind), "history-source"] as const
}
export function isHistoryKey(key: readonly unknown[]) {
  return key.at(-1) === "history-source"
}
export const HISTORY_FRESH_MS = 5 * 60_000
export const HISTORY_RETAIN_MS = 30 * 60_000
export const HISTORY_ATTEMPT_MS = 60_000
export const HISTORY_RETRY_MS = 10_000

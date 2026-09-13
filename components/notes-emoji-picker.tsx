"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useMemo, useState } from "react"

interface EmojiEntry {
  emoji: string
  keywords: string
}

/**
 * Curated emoji set for notes — TV/movie-friendly, no external dependency.
 * Rendered as native glyphs so they match the user's OS emoji font.
 */
const CURATED_EMOJIS: EmojiEntry[] = [
  { emoji: "😂", keywords: "laugh funny lol joy" },
  { emoji: "❤️", keywords: "love heart red favorite" },
  { emoji: "😍", keywords: "love heart eyes favorite" },
  { emoji: "🔥", keywords: "fire hot lit amazing" },
  { emoji: "👏", keywords: "clap applause bravo" },
  { emoji: "😭", keywords: "cry sad tears emotional" },
  { emoji: "🤔", keywords: "thinking hmm curious" },
  { emoji: "😱", keywords: "shock scream scared wow" },
  { emoji: "👻", keywords: "ghost spooky horror" },
  { emoji: "✨", keywords: "sparkles magic special new" },
  { emoji: "🙌", keywords: "celebrate praise hooray" },
  { emoji: "💯", keywords: "perfect hundred score" },
  { emoji: "🥹", keywords: "touching emotional tear" },
  { emoji: "😴", keywords: "sleep boring tired" },
  { emoji: "🤯", keywords: "mind blown shock twist" },
  { emoji: "🍿", keywords: "popcorn movie watch" },
  { emoji: "🎬", keywords: "movie film clapper" },
  { emoji: "📺", keywords: "tv show television" },
  { emoji: "🎭", keywords: "drama theater acting" },
  { emoji: "🏆", keywords: "trophy winner best award" },
  { emoji: "💔", keywords: "heartbreak sad breakup" },
  { emoji: "😬", keywords: "awkward cringe grimace" },
  { emoji: "👀", keywords: "eyes watch see looking" },
  { emoji: "🤡", keywords: "clown funny silly" },
  { emoji: "💩", keywords: "poop bad terrible" },
  { emoji: "👍", keywords: "thumbs up like yes good" },
  { emoji: "👎", keywords: "thumbs down dislike no bad" },
  { emoji: "🙄", keywords: "eyeroll annoyed" },
  { emoji: "🥰", keywords: "love smile affection" },
  { emoji: "😎", keywords: "cool sunglasses" },
  { emoji: "🤩", keywords: "star eyes excited wow" },
  { emoji: "😢", keywords: "cry sad tear" },
  { emoji: "😡", keywords: "angry mad rage" },
  { emoji: "🤢", keywords: "sick gross nauseous" },
  { emoji: "🎉", keywords: "party celebrate congrats" },
  { emoji: "💤", keywords: "sleep boring slow" },
  { emoji: "⭐", keywords: "star rating favorite" },
  { emoji: "🌟", keywords: "star glow special" },
  { emoji: "💭", keywords: "thought think idea" },
  { emoji: "❓", keywords: "question confused" },
  { emoji: "❗", keywords: "important alert wow" },
  { emoji: "🎶", keywords: "music song soundtrack" },
  { emoji: "😺", keywords: "cat smile happy" },
  { emoji: "🐶", keywords: "dog cute" },
  { emoji: "🌈", keywords: "rainbow colorful happy" },
  { emoji: "💀", keywords: "skull dead hilarious" },
  { emoji: "🤝", keywords: "handshake agree deal" },
]

interface NotesEmojiPickerProps {
  /** Called with the selected emoji character(s) */
  onSelect: (emoji: string) => void
  /** Disable all emoji buttons (e.g. while saving) */
  disabled?: boolean
}

/**
 * NotesEmojiPicker Component
 * Lightweight searchable emoji grid for the notes modal.
 */
export function NotesEmojiPicker({ onSelect, disabled }: NotesEmojiPickerProps) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return CURATED_EMOJIS
    return CURATED_EMOJIS.filter((entry) =>
      entry.keywords.toLowerCase().includes(q),
    )
  }, [query])

  return (
    <div className="flex flex-col gap-2">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search emojis..."
        aria-label="Search emojis"
        className="h-8 text-sm"
      />
      {filtered.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500">
          No emojis found for “{query.trim()}”
        </p>
      ) : (
        <div
          role="grid"
          aria-label="Emoji picker"
          className="grid max-h-[200px] grid-cols-8 gap-1 overflow-y-auto"
        >
          {filtered.map((entry) => (
            <Button
              key={entry.emoji + entry.keywords}
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled}
              onClick={() => onSelect(entry.emoji)}
              aria-label={`Insert ${entry.emoji}`}
              title={entry.emoji}
              className="text-lg leading-none"
            >
              <span aria-hidden="true">{entry.emoji}</span>
            </Button>
          ))}
        </div>
      )}
      <p className="text-[11px] text-gray-500">
        Tip: press{" "}
        <kbd className="rounded border px-1 font-sans">Win + .</kbd> or{" "}
        <kbd className="rounded border px-1 font-sans">Cmd + Ctrl + Space</kbd>{" "}
        for the system picker.
      </p>
    </div>
  )
}

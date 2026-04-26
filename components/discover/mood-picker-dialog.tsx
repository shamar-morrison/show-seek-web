"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MOODS } from "@/lib/moods"
import { cn } from "@/lib/utils"

interface MoodPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedMoodId: string | null
  onSelect: (moodId: string) => void
  onSurprise: () => void
}

export function MoodPickerDialog({
  open,
  onOpenChange,
  selectedMoodId,
  onSelect,
  onSurprise,
}: MoodPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Pick a mood</DialogTitle>
          <DialogDescription>
            Start from a feeling instead of a filter. Each mood is wired to a
            curated TMDB mix.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          {MOODS.map((mood) => {
            const isActive = mood.id === selectedMoodId

            return (
              <button
                key={mood.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onSelect(mood.id)}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border px-5 py-4 text-left transition-all duration-200",
                  isActive
                    ? "border-white/20 text-white"
                    : "border-white/10 bg-white/[0.04] text-white/80 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06]",
                )}
                style={{
                  backgroundImage: isActive
                    ? `linear-gradient(135deg, ${mood.color}38, rgba(7, 13, 22, 0.96) 72%)`
                    : undefined,
                  boxShadow: isActive
                    ? `0 20px 60px -32px ${mood.color}`
                    : undefined,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-2xl">{mood.emoji}</span>
                </div>
                <p className="mt-4 text-lg font-bold text-white">
                  {mood.label}
                </p>
                <p className="mt-1 text-sm leading-5 text-white/65">
                  {mood.description}
                </p>
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4">
          <p className="text-xs text-white/50">Six moods. One faster way in.</p>
          <button
            type="button"
            onClick={onSurprise}
            className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-transform duration-200 hover:-translate-y-0.5"
          >
            Surprise me
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

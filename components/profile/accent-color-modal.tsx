"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ACCENT_COLORS } from "@/lib/accent-colors"
import { cn } from "@/lib/utils"
import { Loading03Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

interface AccentColorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accentColor: string
  onSelectColor: (color: string) => Promise<void>
}

export function AccentColorModal({
  open,
  onOpenChange,
  accentColor,
  onSelectColor,
}: AccentColorModalProps) {
  const [pendingColor, setPendingColor] = useState<string | null>(null)

  async function handleSelectColor(nextColor: string) {
    if (pendingColor || nextColor === accentColor) {
      return
    }

    try {
      setPendingColor(nextColor)
      await onSelectColor(nextColor)
      onOpenChange(false)
    } catch {
      // The parent handles user-facing errors and leaves the modal open.
    } finally {
      setPendingColor(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-neutral-950 p-0 text-white sm:max-w-lg">
        <DialogHeader className="gap-3 border-b border-white/10 px-6 pt-6 pb-4">
          <DialogTitle className="text-base font-semibold">
            Accent Color
          </DialogTitle>
          <DialogDescription className="max-w-md text-sm text-white/60">
            Choose the highlight color used across the app.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]" viewportClassName="px-6 py-4">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            {ACCENT_COLORS.map((colorOption, index) => {
              const isSelected = colorOption.value === accentColor
              const isPending = colorOption.value === pendingColor

              return (
                <button
                  key={colorOption.value}
                  type="button"
                  onClick={() => handleSelectColor(colorOption.value)}
                  disabled={pendingColor !== null}
                  aria-pressed={isSelected}
                  aria-busy={isPending}
                  className={cn(
                    "flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors",
                    "hover:bg-white/[0.05] disabled:pointer-events-none disabled:opacity-70",
                    isSelected && "bg-white/[0.08]",
                    index < ACCENT_COLORS.length - 1 &&
                      "border-b border-white/8",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="size-6 shrink-0 rounded-full"
                      style={{ backgroundColor: colorOption.value }}
                    />
                    <span
                      className={cn(
                        "truncate text-sm font-medium",
                        isSelected ? "text-white" : "text-white/88",
                      )}
                      style={isSelected ? { color: accentColor } : undefined}
                    >
                      {colorOption.name}
                    </span>
                  </span>

                  <span className="flex h-8 w-8 items-center justify-center">
                    {isPending ? (
                      <>
                        <HugeiconsIcon
                          icon={Loading03Icon}
                          className="size-4 animate-spin text-primary"
                        />
                        <span className="sr-only">Saving color</span>
                      </>
                    ) : isSelected ? (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <HugeiconsIcon icon={Tick02Icon} className="size-4" />
                      </span>
                    ) : null}
                  </span>
                </button>
              )
            })}
          </div>
        </ScrollArea>

        <div className="border-t border-white/10 px-6 py-4 text-center text-xs text-white/45">
          This changes buttons, highlights, and other accent elements.
        </div>
      </DialogContent>
    </Dialog>
  )
}

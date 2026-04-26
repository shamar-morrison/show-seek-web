"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SUPPORTED_REGIONS, type SupportedRegionCode } from "@/lib/regions"
import { cn } from "@/lib/utils"
import { Loading03Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

interface RegionSelectorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  region: SupportedRegionCode
  onSelectRegion: (region: SupportedRegionCode) => Promise<void>
}

export function RegionSelectorModal({
  open,
  onOpenChange,
  region,
  onSelectRegion,
}: RegionSelectorModalProps) {
  const [pendingRegion, setPendingRegion] =
    useState<SupportedRegionCode | null>(null)

  async function handleSelectRegion(nextRegion: SupportedRegionCode) {
    if (pendingRegion || nextRegion === region) {
      return
    }

    try {
      setPendingRegion(nextRegion)
      await onSelectRegion(nextRegion)
      onOpenChange(false)
    } catch {
      // The parent handles user-facing errors and leaves the modal open.
    } finally {
      setPendingRegion(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-neutral-950 p-0 text-white sm:max-w-lg">
        <DialogHeader className="gap-3 border-b border-white/10 px-6 pt-6 pb-4">
          <DialogTitle className="text-base font-semibold">Region</DialogTitle>
          <DialogDescription className="max-w-md text-sm text-white/60">
            Select your region to see local streaming availability and release
            dates.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]" viewportClassName="px-6 py-4">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            {SUPPORTED_REGIONS.map((supportedRegion, index) => {
              const isSelected = supportedRegion.code === region
              const isPending = supportedRegion.code === pendingRegion

              return (
                <button
                  key={supportedRegion.code}
                  type="button"
                  onClick={() => handleSelectRegion(supportedRegion.code)}
                  disabled={pendingRegion !== null}
                  aria-pressed={isSelected}
                  aria-busy={isPending}
                  className={cn(
                    "flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors",
                    "hover:bg-white/[0.05] disabled:pointer-events-none disabled:opacity-70",
                    isSelected && "bg-white/[0.08]",
                    index < SUPPORTED_REGIONS.length - 1 &&
                      "border-b border-white/8",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="text-2xl" aria-hidden="true">
                      {supportedRegion.emoji}
                    </span>
                    <span
                      className={cn(
                        "truncate text-sm font-medium",
                        isSelected ? "text-white" : "text-white/88",
                      )}
                    >
                      {supportedRegion.name}
                    </span>
                  </span>

                  <span className="flex h-8 w-8 items-center justify-center">
                    {isPending ? (
                      <>
                        <HugeiconsIcon
                          icon={Loading03Icon}
                          className="size-4 animate-spin text-primary"
                        />
                        <span className="sr-only">Saving region</span>
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
          This affects where to watch information and local release dates.
        </div>
      </DialogContent>
    </Dialog>
  )
}

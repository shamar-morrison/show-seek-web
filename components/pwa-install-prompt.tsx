"use client"

import { Button } from "@/components/ui/button"
import { usePWAInstall } from "@/hooks/use-pwa-install"
import { cn } from "@/lib/utils"
import {
  Cancel01Icon,
  Download04Icon,
  MultiplicationSignIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

export function PWAInstallPrompt() {
  const { showPrompt, install, dismiss, cancel } = usePWAInstall()

  if (!showPrompt) {
    return null
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="pwa-install-title"
      aria-describedby="pwa-install-description"
      className={cn(
        "fixed bottom-4 left-1/2 z-50 w-full max-w-md -translate-x-1/2",
        "hidden lg:block", // Desktop only
        "animate-in slide-in-from-bottom-4 fade-in duration-300",
      )}
    >
      <div className="bg-card ring-foreground/10 rounded-xl p-4 ring-1 shadow-lg">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <HugeiconsIcon
              icon={Download04Icon}
              className="size-5 text-primary"
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h2
              id="pwa-install-title"
              className="font-semibold text-foreground"
            >
              Install ShowSeek
            </h2>
            <p
              id="pwa-install-description"
              className="mt-1 text-sm text-muted-foreground"
            >
              Install our app for a better experience with quick access from
              your desktop.
            </p>

            {/* Action buttons */}
            <div className="mt-3 flex gap-2">
              <Button onClick={install} size="sm" className="gap-1.5">
                <HugeiconsIcon
                  icon={Download04Icon}
                  data-icon="inline-start"
                  className="size-4"
                />
                Install
              </Button>
              <Button onClick={cancel} variant="outline" size="sm">
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  data-icon="inline-start"
                  className="size-4"
                />
                No thanks
              </Button>
            </div>
          </div>

          {/* Dismiss (X) button - temporary dismiss for 7 days */}
          <Button
            onClick={dismiss}
            variant="ghost"
            size="icon-sm"
            aria-label="Remind me later"
            className="shrink-0 -mt-1 -mr-1"
          >
            <HugeiconsIcon icon={MultiplicationSignIcon} className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
